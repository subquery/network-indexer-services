// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable, OnModuleInit } from '@nestjs/common';
import client from 'prom-client';

import { AccountService } from 'src/account/account.service';
import { Config } from 'src/configure/configure.module';
import { DockerService } from 'src/services/docker.service';
import { debugLogger } from 'src/utils/logger';

import { PUSHGATEWAY_DEV, PUSHGATEWAY_PROD } from './constant';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../../package.json');

@Injectable()
export class UserMetricsService implements OnModuleInit {
  private gateway: client.Pushgateway;
  private gauge: client.Gauge<string>;
  private prefix: string;

  private interval = 1000 * 60 * 60 * 6;

  constructor(
    private docker: DockerService,
    private accountService: AccountService,
    private config: Config,
  ) { }

  public onModuleInit() {
    this.prefix = 'subquery_indexer';

    this.gateway = new client.Pushgateway(this.pushgatewayUrl());
    this.gauge = new client.Gauge({
      name: `${this.prefix}_coordinator_info`,
      help: 'coordiantor information',
      labelNames: ['coordinator_version', 'proxy_version'],
    });

    this.pushServiceInfo();
    this.periodicPushServiceInfo();
  }

  private pushgatewayUrl() {
    return this.config.dev ? PUSHGATEWAY_DEV : PUSHGATEWAY_PROD;
  }

  public async pushServiceInfo() {
    const proxyVersion = await this.docker.imageVersion('coordinator_proxy');
    const indexer = await this.accountService.getIndexer();
    if (!indexer) return;

    try {
      this.gauge
        .labels({
          coordinator_version: version,
          proxy_version: proxyVersion,
        })
        .set(1);

      await this.gateway.pushAdd({ jobName: `${this.prefix}_service`, groupings: { instance: indexer } });
    } catch {
      debugLogger('metrics', `failed to send service info ${version} ${proxyVersion} ${indexer}`);
    }
  }

  async periodicPushServiceInfo() {
    setInterval(async () => {
      await this.pushServiceInfo();
    }, this.interval);
  }
}

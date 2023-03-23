// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import client from 'prom-client';

import { Injectable, OnModuleInit } from '@nestjs/common';
import { AccountService } from 'src/account/account.service';
import { Config } from 'src/configure/configure.module';
import { DockerService } from 'src/services/docker.service';
import { debugLogger } from 'src/utils/logger';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../../package.json');

@Injectable()
export class PublicMetricsService implements OnModuleInit {
  private pushgateway: client.Pushgateway;
  private gauge: client.Gauge<string>;
  private prefix: string;

  private interval = 1000 * 60 * 60 * 6;

  constructor(
    private docker: DockerService,
    private accountService: AccountService,
    private config: Config,
  ) {}

  public async onModuleInit() {
    this.prefix = 'subquery_indexer';
    this.pushgateway = new client.Pushgateway(this.config.pushGateway);
    this.gauge = new client.Gauge({
      name: `${this.prefix}_coordinator_info`,
      help: 'coordiantor information',
      labelNames: ['coordinator_version', 'proxy_version'],
    });

    await this.pushServiceInfo();
    await this.periodicPushServiceInfo();
  }

  public async pushServiceInfo() {
    const proxyVersion = await this.docker.imageVersion('coordinator_proxy');
    const indexer = await this.accountService.getIndexer();
    if (!indexer) return;

    try {
      this.gauge
        .labels({
          version,
          proxy_version: proxyVersion,
        })
        .set(1);

      await this.pushgateway.pushAdd({
        jobName: `${this.prefix}_service`,
        groupings: { instance: indexer },
      });
    } catch {
      debugLogger('metrics', `failed to send service info ${version} ${proxyVersion}`);
    }
  }

  async periodicPushServiceInfo() {
    setInterval(async () => {
      await this.pushServiceInfo();
    }, this.interval);
  }
}

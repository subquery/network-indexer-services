// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable, OnModuleInit } from '@nestjs/common';
import client from 'prom-client';
import { AccountService } from 'src/account/account.service';
import { debugLogger } from 'src/utils/logger';
import { DockerService } from './docker.service';

@Injectable()
export class MetricsService implements OnModuleInit {
  private gateway: client.Pushgateway;
  private prefix: string;

  constructor(private docker: DockerService, private accountService: AccountService) { }

  public onModuleInit() {
    this.gateway = new client.Pushgateway('https://pushgateway-dev.onfinality.me');
    this.pushServiceInfo();
    this.prefix = 'subql_network';
  }

  public async pushServiceInfo() {
    const coordinatorVersion = await this.docker.imageVersion('coordinator_service');
    const proxyVersion = await this.docker.imageVersion('coordinator_proxy');
    const indexer = await this.accountService.getIndexer();

    try {
      await this.gateway.pushAdd({
        jobName: 'subql_indexer_service',
        groupings: {
          [`${this.prefix}_coordinator_version`]: coordinatorVersion,
          [`${this.prefix}_proxy_version`]: proxyVersion,
          [`${this.prefix}_indexer`]: indexer,
        },
      });
    } catch {
      debugLogger(
        'metrics',
        `failed to send service info ${coordinatorVersion} ${proxyVersion} ${indexer}`,
      );
    }
  }
}

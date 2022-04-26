// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable, OnModuleInit } from '@nestjs/common';
import client from 'prom-client';
import { AccountService } from 'src/account/account.service';
import { DockerService } from './docker.service';

@Injectable()
export class MetricsService implements OnModuleInit {
  private gateway: client.Pushgateway;

  constructor(private docker: DockerService, private accountService: AccountService) { }

  public onModuleInit() {
    this.gateway = new client.Pushgateway('https://pushgateway-test.onfinality.me');
    this.sendQueryCount();
  }

  public async sendQueryCount() {
    const coordinatorVersion = await this.docker.imageVersion('coordinator_service');
    const proxyVersion = await this.docker.imageVersion('coordinator_proxy');
    const indexer = await this.accountService.getIndexer();
    this.gateway.pushAdd({
      jobName: 'indexer_service',
      groupings: { coordinator_version: coordinatorVersion, proxy_version: proxyVersion, indexer },
    });
  }
}

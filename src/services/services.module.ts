// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccountModule } from 'src/account/account.module';
import { Project } from 'src/project/project.model';

import { ContractService } from './contract.service';
import { DockerRegistryService } from './docker.registry.service';
import { DockerService } from './docker.service';
import { MetricsService } from './metrics.service';
import { NetworkService } from './network.service';
import { QueryService } from './query.service';
import { SubscriptionService } from './subscription.service';

@Module({
  imports: [AccountModule, TypeOrmModule.forFeature([Project])],
  providers: [
    ContractService,
    DockerRegistryService,
    DockerService,
    MetricsService,
    NetworkService,
    QueryService,
    SubscriptionService,
  ],
  exports: [
    ContractService,
    DockerRegistryService,
    DockerService,
    MetricsService,
    NetworkService,
    QueryService,
    SubscriptionService
  ],
})
export class ServicesModule { }

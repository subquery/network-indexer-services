// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NetworkService } from 'src/network/network.service';
import { SubscriptionModule } from '../subscription/subscription.module';
import { Controller, Indexer } from './account.model';
import { AccountResolver } from './account.resolver';
import { AccountService } from './account.service';
import { ContractService } from './contract.service';
import { DockerRegistryService } from './docker.registry.service';
import { DockerService } from './docker.service';
import { OnChainService } from './onchain.service';
import { QueryService } from './query.service';
import { RewardService } from './reward.service';
import { ServiceResolver } from './service.resolver';

@Module({
  imports: [
    SubscriptionModule,
    TypeOrmModule.forFeature([Controller, Indexer]),
    ScheduleModule.forRoot(),
  ],
  providers: [
    ContractService,
    DockerRegistryService,
    DockerService,
    OnChainService,
    QueryService,
    RewardService,
    ServiceResolver,
    AccountService,
    AccountResolver,
    NetworkService,
  ],
  exports: [
    ContractService,
    DockerRegistryService,
    DockerService,
    OnChainService,
    QueryService,
    AccountService,
    RewardService,
  ],
})
export class CoreModule {}

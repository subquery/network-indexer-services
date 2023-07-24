// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

import {SubscriptionModule} from "../subscription/subscription.module";
import {Controller, Indexer} from "./account.model";
import {AccountResolver} from "./account.resolver";
import {AccountService} from "./account.service";
import { ContractService } from './contract.service';
import { DockerRegistryService } from './docker.registry.service';
import { DockerService } from './docker.service';
import { NetworkService } from './network.service';
import { QueryService } from './query.service';
import { ServiceResolver } from './service.resolver';

@Module({
  imports: [
    SubscriptionModule,
    TypeOrmModule.forFeature([Controller,Indexer]),
    ScheduleModule.forRoot(),
  ],
  providers: [
    ContractService,
    DockerRegistryService,
    DockerService,
    NetworkService,
    QueryService,
    ServiceResolver,
    AccountService,
    AccountResolver,
  ],
  exports: [ContractService, DockerRegistryService, DockerService, NetworkService, QueryService, AccountService],
})
export class CoreModule {}

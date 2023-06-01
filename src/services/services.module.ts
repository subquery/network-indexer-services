// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { forwardRef, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Controller } from '../account/account.model';
import { AccountModule } from '../account/account.module';

import { ContractService } from './contract.service';
import { DockerRegistryService } from './docker.registry.service';
import { DockerService } from './docker.service';
import { NetworkService } from './network.service';
import { QueryService } from './query.service';
import { ServiceResolver } from './service.resolver';

@Module({
  imports: [
    forwardRef(() => AccountModule),
    TypeOrmModule.forFeature([Controller]),
    ScheduleModule.forRoot(),
  ],
  providers: [
    ContractService,
    DockerRegistryService,
    DockerService,
    NetworkService,
    QueryService,
    ServiceResolver,
  ],
  exports: [ContractService, DockerRegistryService, DockerService, NetworkService, QueryService],
})
export class ServicesModule {}

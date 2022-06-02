// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectService } from './project.service';
import { ProjectResolver } from './project.resolver';
import { Project } from './project.model';
import { AccountModule } from 'src/account/account.module';
import { NetworkService } from './network.service';
import { ContractService } from './contract.service';
import { DockerService } from './docker.service';
import { SubscriptionService } from './subscription.service';
import { QueryService } from './query.service';
import { DockerRegistryService } from './docker.registry.service';
import { MetricsService } from './metrics.service';
import { DBModule } from 'src/db/db.module';

@Module({
  imports: [AccountModule, DBModule, TypeOrmModule.forFeature([Project])],
  providers: [
    ProjectService,
    ProjectResolver,
    NetworkService,
    ContractService,
    DockerService,
    SubscriptionService,
    QueryService,
    DockerRegistryService,
    MetricsService,
  ],
  exports: [ProjectService],
})
export class ProjectModule { }

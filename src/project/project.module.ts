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

@Module({
  imports: [AccountModule, TypeOrmModule.forFeature([Project])],
  providers: [
    ProjectService,
    ProjectResolver,
    NetworkService,
    ContractService,
    DockerService,
    SubscriptionService,
  ],
  exports: [ProjectService],
})
export class ProjectModule { }

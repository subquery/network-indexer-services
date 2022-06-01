// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NetworkService } from 'src/services/network.service';
//import { ContractService } from 'src/services/contract.service';
//import { QueryService } from 'src/services/contract.service';

import { ProjectService } from './project.service';
import { ProjectResolver } from './project.resolver';
import { Project } from './project.model';

@Module({
  imports: [NetworkService, TypeOrmModule.forFeature([Project])],
  providers: [ProjectService,ProjectResolver],
  exports: [ProjectService],
})
export class ProjectModule { }

// Copyright 2020-2021 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectService } from './project.service';
import { ProjectResolver } from './project.resolver';
import { Project } from './project.model';
import { AccountModule } from 'src/account/account.module';
import { ReportService } from './report.service';
import { ContractService } from './contract.service';

@Module({
  imports: [AccountModule, TypeOrmModule.forFeature([Project])],
  providers: [ProjectService, ProjectResolver, ReportService, ContractService],
  exports: [ProjectService],
})
export class ProjectModule {}

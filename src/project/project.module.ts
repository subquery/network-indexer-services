// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ServicesModule } from 'src/services/services.module';

import { ProjectService } from './project.service';
import { ProjectResolver } from './project.resolver';
import { Project } from './project.model';

@Module({
  imports: [ServicesModule, TypeOrmModule.forFeature([Project])],
  providers: [ProjectService,ProjectResolver],
  exports: [ProjectService],
})
export class ProjectModule { }

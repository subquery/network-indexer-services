// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ServicesModule } from 'src/services/services.module';
import { Project } from 'src/project/project.model';

import { PaygService } from './payg.service';
import { PaygResolver } from './payg.resolver';
import { Channel } from './payg.model';

@Module({
  imports: [ServicesModule, TypeOrmModule.forFeature([Channel]), TypeOrmModule.forFeature([Project])],
  providers: [PaygService, PaygResolver],
  exports: [PaygService],
})
export class PaygModule {}

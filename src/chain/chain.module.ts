// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ServicesModule } from 'src/services/services.module';
import { DBModule } from 'src/db/db.module';

import { ChainService } from './chain.service';
import { Chain } from './chain.model';
import { MetricsModule } from 'src/metrics/metrics.module';

@Module({
  imports: [ServicesModule, DBModule, MetricsModule, TypeOrmModule.forFeature([Chain])],
  providers: [ChainService],
  exports: [ChainService],
})
export class ChainModule {}
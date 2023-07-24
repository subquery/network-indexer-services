// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CoreModule } from '../core/core.module';
import { DBModule } from '../db/db.module';
import { MetricsModule } from '../metrics/metrics.module';

import { Chain } from './chain.model';
import { ChainService } from './chain.service';

@Module({
  imports: [CoreModule, DBModule, MetricsModule, TypeOrmModule.forFeature([Chain])],
  providers: [ChainService],
  exports: [ChainService],
})
export class ChainModule {}

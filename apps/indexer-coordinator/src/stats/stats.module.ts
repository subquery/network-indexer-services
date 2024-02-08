// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatsController } from './stats.controller';
import { ProjectStatisticsEntity } from './stats.model';
import { StatsService } from './stats.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectStatisticsEntity])],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}

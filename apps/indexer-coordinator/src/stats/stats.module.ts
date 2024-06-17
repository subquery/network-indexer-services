// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectModule } from 'src/project/project.module';
import { DbStatsController } from './db.stats.controller';
import { DbStatsService } from './db.stats.service';
import { StatsController } from './stats.controller';
import { ProjectStatisticsEntity } from './stats.model';
import { StatsService } from './stats.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectStatisticsEntity]), ProjectModule],
  controllers: [StatsController, DbStatsController],
  providers: [StatsService, DbStatsService],
})
export class StatsModule {}

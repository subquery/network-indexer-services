// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Controller, Get, Query } from '@nestjs/common';
import { DbStatsService } from './db.stats.service';
import { DbStatsStorageType } from './types';

@Controller('db')
export class DbStatsController {
  constructor(private dbStatsService: DbStatsService) {}

  @Get('all-stats')
  async getDbStats(): Promise<{ [deploymentId: string]: DbStatsStorageType }> {
    return this.dbStatsService.getAllSubqueryDbStats();
  }

  @Get('stats')
  async getProjectDbStat(@Query('deploymentId') deploymentId: string): Promise<DbStatsStorageType> {
    return this.dbStatsService.getProjectDbStats(deploymentId);
  }

  @Get('size')
  async getProjectDbSize(@Query('deploymentId') deploymentId: string): Promise<string> {
    return (await this.dbStatsService.getProjectDbStats(deploymentId)).size || '0';
  }
}

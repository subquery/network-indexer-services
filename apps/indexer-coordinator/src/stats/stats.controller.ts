// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { plainToInstance, instanceToPlain } from 'class-transformer';
import { DbStatsService } from './db.stats.service';
import { ProjectStatisticsEntity } from './stats.model';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private statsService: StatsService, private dbStatsService: DbStatsService) {}

  @Post(':deploymentId/:timestamp')
  async saveStats(
    @Param('deploymentId') deploymentId: string,
    @Param('timestamp') timestamp: string,
    @Body() body: any
  ): Promise<any> {
    const stats = plainToInstance(ProjectStatisticsEntity, body);
    return instanceToPlain(
      await this.statsService.saveStats({
        ...stats,
        dataTime: new Date(timestamp),
        deploymentCid: deploymentId,
      })
    );
  }

  @Post('')
  async saveStatsMap(@Body() body: any) {
    await this.statsService.saveStatsMap(body);
  }

  @Get(':deploymentId/:from/:to')
  async getStatsList(
    @Param('deploymentId') deploymentId: string,
    @Param('from') from: string,
    @Param('to') to: string
  ): Promise<any> {
    return instanceToPlain(await this.statsService.getStatsList(deploymentId, from, to));
  }

  @Get(':deploymentId')
  async getProjectDbSize(@Param('deploymentId') deploymentId: string): Promise<string> {
    return this.dbStatsService.getProjectDbSize(deploymentId);
  }
}

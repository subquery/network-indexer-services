// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { plainToClass, instanceToPlain } from 'class-transformer';
import { ProjectStatisticsEntity, ProjectStatisticsMapInput } from './stats.model';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private statsService: StatsService) {}

  @Post(':deploymentId/:timestamp')
  async saveStats(
    @Param('deploymentId') deploymentId: string,
    @Param('timestamp') timestamp: string,
    @Body() body: any
  ): Promise<any> {
    const stats = plainToClass(ProjectStatisticsEntity, body);
    return instanceToPlain(
      await this.statsService.saveStats({
        ...stats,
        dataTime: new Date(timestamp),
        deploymentCid: deploymentId,
      })
    );
  }

  @Post('saveStatsList')
  async saveStatsList(@Body() body: any) {
    const statsMap = plainToClass(ProjectStatisticsMapInput, body);
    await this.statsService.saveStatsList(statsMap);
  }

  @Get(':deploymentId/:from/:to')
  async getStats(
    @Param('deploymentId') deploymentId: string,
    @Param('from') from: string,
    @Param('to') to: string
  ): Promise<any> {
    return instanceToPlain(await this.statsService.getStatsMap(deploymentId, from, to));
  }
}

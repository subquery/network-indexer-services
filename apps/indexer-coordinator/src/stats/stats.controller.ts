// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { plainToInstance, instanceToPlain } from 'class-transformer';
import { ProjectStatisticsEntity } from './stats.model';
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
  async saveStatsList(@Body() body: any) {
    await this.statsService.saveStatsList(body);
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

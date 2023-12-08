// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { getLogger } from 'src/utils/logger';
import { Between, Repository } from 'typeorm';
import { ProjectStatisticsEntity, ProjectStatisticsMapInput } from './stats.model';

@Injectable()
export class StatsService {
  private readonly logger = getLogger(StatsService.name);

  constructor(
    @InjectRepository(ProjectStatisticsEntity)
    private projectStatisticsRepo: Repository<ProjectStatisticsEntity>
  ) {}

  async saveStats(stats: ProjectStatisticsEntity): Promise<ProjectStatisticsEntity> {
    const existingStats = await this.projectStatisticsRepo.findOne({
      where: {
        deploymentCid: stats.deploymentCid,
        dataTime: stats.dataTime,
      },
    });
    if (existingStats) {
      if (stats.time >= existingStats.time) {
        existingStats.time = stats.time;
        existingStats.failure = stats.failure;
        existingStats.freeHttp = stats.freeHttp;
        existingStats.freeP2p = stats.freeP2p;
        existingStats.caHttp = stats.caHttp;
        existingStats.caP2p = stats.caP2p;
        existingStats.paygHttp = stats.paygHttp;
        existingStats.paygP2p = stats.paygP2p;
        return await this.projectStatisticsRepo.save(existingStats);
      }
      return existingStats;
    }
    return await this.projectStatisticsRepo.save(stats);
  }

  async saveStatsMap(statsMap: any) {
    try {
      const statsList: ProjectStatisticsEntity[] = [];
      for (const hour in statsMap) {
        const stats = statsMap[hour];
        for (const cid in stats) {
          const stat = plainToInstance(ProjectStatisticsEntity, stats[cid]);
          statsList.push({
            ...stat,
            dataTime: this.houtToTime(hour),
            deploymentCid: cid,
          });
        }
      }

      const cidHourPairList = statsList.map((stat) => {
        return {
          deploymentCid: stat.deploymentCid,
          dataTime: stat.dataTime,
        };
      });

      const existingStatsList = await this.projectStatisticsRepo.find({
        where: cidHourPairList,
      });

      for (const existingStats of existingStatsList) {
        const index = statsList.findIndex((s) => {
          return (
            s.deploymentCid === existingStats.deploymentCid &&
            s.dataTime.getTime() === existingStats.dataTime.getTime()
          );
        });
        if (index === -1) {
          continue;
        }
        if (statsList[index].time > existingStats.time) {
          existingStats.time = statsList[index].time;
          existingStats.failure = statsList[index].failure;
          existingStats.freeHttp = statsList[index].freeHttp;
          existingStats.freeP2p = statsList[index].freeP2p;
          existingStats.caHttp = statsList[index].caHttp;
          existingStats.caP2p = statsList[index].caP2p;
          existingStats.paygHttp = statsList[index].paygHttp;
          existingStats.paygP2p = statsList[index].paygP2p;
        }
        statsList[index] = existingStats;
      }

      await this.projectStatisticsRepo.save(statsList);
    } catch (e) {
      this.logger.error(`Failed to save stats list: ${e.message}`);
      this.logger.debug(`statsMap: ${JSON.stringify(statsMap)}`);
      throw e;
    }
  }

  houtToTime(dateHour: string): Date {
    const [date, hour] = dateHour.split(' ');
    return new Date(`${date}T${hour}:00:00Z`);
  }

  timeToHour(date: Date): string {
    return date.toUTCString().split(':')[0].replace('T', ' ');
  }

  async getStatsList(deploymentId: string, from: string, to: string) {
    return await this.projectStatisticsRepo.find({
      where: {
        deploymentCid: deploymentId,
        dataTime: Between(new Date(from), new Date(to)),
      },
      order: {
        dataTime: 'ASC',
      },
    });
  }

  async getStatsMap(
    deploymentId: string,
    from: string,
    to: string
  ): Promise<ProjectStatisticsMapInput> {
    const statsList = await this.projectStatisticsRepo.find({
      where: {
        deploymentCid: deploymentId,
        dataTime: Between(new Date(from), new Date(to)),
      },
      order: {
        dataTime: 'ASC',
      },
    });
    const statsMap: ProjectStatisticsMapInput = {};
    for (const stats of statsList) {
      const hour = stats.dataTime.getTime().toString();
      if (!statsMap[hour]) {
        statsMap[hour] = {};
      }
      statsMap[hour][stats.deploymentCid] = stats;
    }

    return statsMap;
  }
}

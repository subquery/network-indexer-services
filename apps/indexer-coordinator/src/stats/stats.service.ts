// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { ProjectStatisticsEntity, ProjectStatisticsMapInput } from './stats.model';

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(ProjectStatisticsEntity)
    private projectStatisticsRepo: Repository<ProjectStatisticsEntity>
  ) {}

  async saveStats(stats: ProjectStatisticsEntity): Promise<ProjectStatisticsEntity> {
    return await this.projectStatisticsRepo.save(stats);
  }

  async saveStatsList(statsMap: ProjectStatisticsMapInput) {
    const statsList: ProjectStatisticsEntity[] = [];
    for (const hour in statsMap) {
      const stats = statsMap[hour];
      for (const cid in stats) {
        const stat = stats[cid];
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

    const existingStats = await this.projectStatisticsRepo.find({
      where: cidHourPairList,
    });

    for (const stat of existingStats) {
      const index = statsList.findIndex((s) => {
        return s.deploymentCid === stat.deploymentCid && s.dataTime === stat.dataTime;
      });
      if (index === -1) {
        continue;
      }
      if (statsList[index].time > stat.time) {
        stat.time = statsList[index].time;
        stat.failure = statsList[index].failure;
        stat.freeHttp = statsList[index].freeHttp;
        stat.freeP2p = statsList[index].freeP2p;
        stat.caHttp = statsList[index].caHttp;
        stat.caP2p = statsList[index].caP2p;
        stat.paygHttp = statsList[index].paygHttp;
        stat.paygP2p = statsList[index].paygP2p;
      }
    }

    await this.projectStatisticsRepo.save(statsList);
  }

  houtToTime(dateHour: string): Date {
    const [date, hour] = dateHour.split(' ');
    return new Date(`${date} ${hour}:00:00`);
  }

  timeToHour(date: Date): string {
    return date.toISOString().split(':')[0].replace('T', ' ');
  }

  async getStatsList(deploymentId: string, from: string, to: string) {
    return await this.projectStatisticsRepo.find({
      where: {
        deploymentCid: deploymentId,
        dataTime: Between(new Date(from), new Date(to)),
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
    });
    const statsMap: ProjectStatisticsMapInput = {};
    for (const stats of statsList) {
      const hour = this.timeToHour(stats.dataTime);
      if (!statsMap[hour]) {
        statsMap[hour] = {};
      }
      statsMap[hour][stats.deploymentCid] = stats;
    }

    return statsMap;
  }
}

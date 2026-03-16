// Copyright 2020-2025 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ProjectService } from 'src/project/project.service';
import { ProjectType } from 'src/project/types';
import { schemaName } from 'src/utils/docker';
import { getLogger } from 'src/utils/logger';
import { redisGetObj, redisSetObj } from 'src/utils/redis';
import { EntityManager } from 'typeorm';
import { DbSizeResultType, DbStatsStorageType } from './types';

@Injectable()
export class DbStatsService {
  private readonly logger = getLogger(DbStatsService.name);

  constructor(
    private projectService: ProjectService,
    @InjectEntityManager() private entityManager: EntityManager
  ) {
    // TODO test only
    // this.autoUpdateDbStats();
  }

  // 1 time per day
  @Cron('2 2 2 * * *')
  async autoUpdateDbStatsCronJob() {
    await this.autoUpdateDbStats();
  }

  async getAllSubqueryProjectIds(): Promise<string[]> {
    return (await this.projectService.getAliveProjects())
      .filter((project) => project.projectType === ProjectType.SUBQUERY)
      .map((project) => project.id);
  }

  async autoUpdateDbStats(): Promise<void> {
    const projectIds = await this.getAllSubqueryProjectIds();
    for (const id of projectIds) {
      await this.updateProjectDbStats(id);
    }
  }

  async updateProjectDbStats(id: string): Promise<void> {
    try {
      const schema = schemaName(id);
      const sql = `
SELECT sum(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename)))::bigint AS size
FROM pg_tables
WHERE schemaname = '${schema}';
    `;
      const result: DbSizeResultType[] = await this.entityManager.query(sql);
      const size = (result[0]?.size ?? 0).toString();
      const key = this.getDbStatsKey(id);
      this.logger.info(`Updating db size for ${id} to ${size} bytes`);
      await redisSetObj(key, {
        size,
        timestamp: Date.now(),
      } as DbStatsStorageType);
    } catch (e) {
      this.logger.error(`Failed to update db size for ${id}`, e);
    }
  }

  async getProjectDbStats(id: string): Promise<DbStatsStorageType | null> {
    const key = this.getDbStatsKey(id);
    return await redisGetObj<DbStatsStorageType>(key);
  }

  async getAllSubqueryDbStats(): Promise<{ [id: string]: DbStatsStorageType }> {
    const projectIds = await this.getAllSubqueryProjectIds();
    const dbStats: { [id: string]: DbStatsStorageType } = {};
    for (const id of projectIds) {
      dbStats[id] = await this.getProjectDbStats(id);
    }
    return dbStats;
  }

  getDbStatsKey(id: string): string {
    return `coordinator:db-stats:${id}`;
  }
}

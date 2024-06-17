// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
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
    this.autoUpdateDbStats();
  }

  @Cron('0 0 */12 * * *')
  async autoUpdateDbStatsCronJob() {
    await this.autoUpdateDbStats();
  }

  async getAllSubqueryProjects(): Promise<string[]> {
    return (await this.projectService.getAliveProjects())
      .filter((project) => project.projectType === ProjectType.SUBQUERY)
      .map((project) => project.id);
  }

  async autoUpdateDbStats(): Promise<void> {
    const projects = await this.getAllSubqueryProjects();
    for (const deploymentId of projects) {
      await this.updateProjectDbStats(deploymentId);
    }
  }

  async updateProjectDbStats(deploymentId: string): Promise<void> {
    try {
      const schema = schemaName(deploymentId);
      const sql = `
SELECT sum(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename)))::bigint AS size
FROM pg_tables
WHERE schemaname = '${schema}';
    `;
      const result: DbSizeResultType[] = await this.entityManager.query(sql);
      const size = (result[0]?.size ?? 0).toString();
      const key = this.getDbStatsKey(deploymentId);
      this.logger.info(`Updating db size for ${deploymentId} to ${size} bytes`);
      await redisSetObj(key, {
        size,
        timestamp: Date.now(),
      } as DbStatsStorageType);
    } catch (e) {
      this.logger.error(`Failed to update db size for ${deploymentId}`, e);
    }
  }

  async getProjectDbStats(deploymentId: string): Promise<DbStatsStorageType | null> {
    const key = this.getDbStatsKey(deploymentId);
    return await redisGetObj<DbStatsStorageType>(key);
  }

  async getAllSubqueryDbStats(): Promise<{ [deploymentId: string]: DbStatsStorageType }> {
    const projects = await this.getAllSubqueryProjects();
    const dbStats: { [deploymentId: string]: DbStatsStorageType } = {};
    for (const deploymentId of projects) {
      dbStats[deploymentId] = await this.getProjectDbStats(deploymentId);
    }
    return dbStats;
  }

  getDbStatsKey(deploymentId: string): string {
    return `coordinator:db-stats:${deploymentId}`;
  }
}

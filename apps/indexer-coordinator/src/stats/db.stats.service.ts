// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { getLogger } from 'src/utils/logger';

@Injectable()
export class DbStatsService {
  private readonly logger = getLogger(DbStatsService.name);

  async getSubqueryProjects(): Promise<string[]> {
    this.logger.info('Getting subquery projects');
    return ['subquery'];
  }

  async autoUpdateDbSize(): Promise<void> {
    this.logger.info('Auto updating db size');
  }

  async updateProjectDbSize(deploymentId: string): Promise<void> {
    this.logger.info(`Updating db size for ${deploymentId}`);
  }

  async getProjectDbSize(deploymentId: string): Promise<string> {
    this.logger.info(`Getting db size for ${deploymentId}`);
    return '0MB';
  }

  getDbSizeKey(deploymentId: string): string {
    return `coordinator:dbSize:${deploymentId}`;
  }
}

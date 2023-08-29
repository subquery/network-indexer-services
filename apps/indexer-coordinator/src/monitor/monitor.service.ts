// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { DockerService } from '../core/docker.service';
import { ProjectService } from '../project/project.service';
import { nodeContainer } from '../utils/docker';
import { getLogger } from '../utils/logger';

@Injectable()
export class MonitorService {
  constructor(private docker: DockerService, private projectService: ProjectService) {
    this.checkNodeHealth();
  }

  private readonly logger = getLogger('monitor');
  private readonly nodeUnhealthTimes = 3;
  private nodeUnhealthTimesMap = new Map<string, number>();

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkNodeHealth() {
    this.logger.info(`check node health started`);
    const projects = await this.projectService.getAliveProjects();
    this.logger.info(`projects's length: ${projects.length}`);
    for (const project of projects) {
      try {
        const result = await axios.get(`${project.nodeEndpoint}/health`, {
          timeout: 5000,
        });
        if (result.status === 200) {
          this.nodeUnhealthTimesMap.set(project.id, 0);
        } else {
          this.nodeUnhealthTimesMap.set(
            project.id,
            (this.nodeUnhealthTimesMap.get(project.id) ?? 0) + 1
          );
        }
      } catch (e) {
        this.nodeUnhealthTimesMap.set(
          project.id,
          (this.nodeUnhealthTimesMap.get(project.id) ?? 0) + 1
        );
      }
    }
    await this.restartUnhealthyNode();
    this.logger.info(`check node health finished`);
  }

  async restartUnhealthyNode() {
    const containersToRestart = [];
    for (const [id, times] of this.nodeUnhealthTimesMap) {
      if (times >= this.nodeUnhealthTimes) {
        containersToRestart.push(nodeContainer(id));
      }
    }
    if (containersToRestart.length > 0) {
      this.logger.info(`restart unhealthy nodes: ${containersToRestart.join(',')}`);
      await this.docker.restart(containersToRestart);
    }
  }
}

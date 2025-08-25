// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { DesiredStatus } from 'src/core/types';
import { HostType, ProjectType, SubqueryEndpointType } from 'src/project/types';
import { DockerService } from '../core/docker.service';
import { ProjectService } from '../project/project.service';
import { validateQueryEndpoint } from '../project/validator/subquery.validator';
import { nodeContainer, queryContainer } from '../utils/docker';
import { getLogger } from '../utils/logger';

@Injectable()
export class MonitorService {
  constructor(private docker: DockerService, private projectService: ProjectService) {
    this.checkNodeHealth();
  }

  private readonly logger = getLogger('monitor');
  private readonly nodeUnhealthTimes = 3;
  private readonly queryUnhealthTimes = 3;
  private nodeUnhealthTimesMap = new Map<string, number>();
  private queryUnhealthTimesMap = new Map<string, number>();

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkNodeHealth() {
    this.logger.info(`check node health started`);
    const projects = await this.projectService.getAllProjects('monitor');
    this.logger.info(`projects's length: ${projects.length}`);

    const healthCheckTasks = projects.map((project) => this.checkProjectHealth(project));
    await Promise.allSettled(healthCheckTasks);

    await this.restartUnhealthyNodeAndQuery();
    this.logger.info(`check node and query health finished`);
  }

  private async checkProjectHealth(project: any) {
    if (project.status === DesiredStatus.STOPPED) {
      this.nodeUnhealthTimesMap.delete(project.id);
      this.queryUnhealthTimesMap.delete(project.id);
      return;
    }

    if (project.projectType !== ProjectType.SUBQUERY) {
      return;
    }

    if (project.hostType === HostType.USER_MANAGED) {
      await this.checkUserManagedProject(project);
      return;
    }

    const nodeHealthy = await this.checkEndpointHealth(
      project,
      SubqueryEndpointType.Node,
      this.nodeUnhealthTimesMap,
      'node'
    );

    if (nodeHealthy) {
      await this.checkEndpointHealth(
        project,
        SubqueryEndpointType.Query,
        this.queryUnhealthTimesMap,
        'query'
      );
    } else {
      this.queryUnhealthTimesMap.set(project.id, 0);
    }
  }

  private async checkUserManagedProject(project: any) {
    const endpoint = project.serviceEndpoints.find((e) => e.key === SubqueryEndpointType.Query);
    if (!endpoint) return;

    const res = await validateQueryEndpoint(endpoint.value, project);
    if (res.valid !== endpoint.valid) {
      endpoint.valid = res.valid;
      endpoint.reason = res.reason;
      await this.projectService.saveProject(project);
    }
  }

  private async checkEndpointHealth(
    project: any,
    endpointType: SubqueryEndpointType,
    timesMap: Map<string, number>,
    serviceName: string
  ): Promise<boolean> {
    try {
      const endpoint = project.serviceEndpoints.find((e: any) => e.key === endpointType);
      if (!endpoint?.value) {
        this.logger.debug(`${serviceName} endpoint not found for project ${project.id}`);
        return false;
      }

      const healthPath =
        endpointType === SubqueryEndpointType.Query ? '.well-known/apollo/server-health' : 'health';
      const url = new URL(healthPath, endpoint.value);
      const result = await axios.get(url.toString(), { timeout: 5000 });

      if (result.status === 200) {
        timesMap.set(project.id, 0);
        return true;
      } else {
        this.logger.debug(`check ${serviceName} health failed: ${result.status}`);
        timesMap.set(project.id, (timesMap.get(project.id) ?? 0) + 1);
        return false;
      }
    } catch (e: any) {
      this.logger.debug(`check ${serviceName} health error: ${e.message}`);
      timesMap.set(project.id, (timesMap.get(project.id) ?? 0) + 1);
      return false;
    }
  }

  async restartUnhealthyNodeAndQuery() {
    const containersToRestart = [];
    for (const [id, times] of this.nodeUnhealthTimesMap) {
      if (times >= this.nodeUnhealthTimes) {
        containersToRestart.push(nodeContainer(id));
      }
    }
    for (const [id, times] of this.queryUnhealthTimesMap) {
      if (times >= this.queryUnhealthTimes) {
        containersToRestart.push(queryContainer(id));
      }
    }
    if (containersToRestart.length > 0) {
      this.logger.info(`restart unhealthy nodes: ${containersToRestart.join(',')}`);
      await this.docker.restart(containersToRestart);
    }
  }
}

import { Injectable } from '@nestjs/common';
import { DockerService } from '../core/docker.service';
import { ProjectService } from '../project/project.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { nodeContainer } from '../utils/docker';
import { getLogger } from '../utils/logger';

@Injectable()
export class MonitorService {
  constructor(private docker: DockerService, private projectService: ProjectService) {
    this.checkNodeHealth();
  }

  private readonly nodeUnhealthTimes = 3;
  private nodeUnhealthTimesMap = new Map<string, number>();

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkNodeHealth() {
    getLogger('monitor').info(`check node health started`);
    let projects = await this.projectService.getAliveProjects();
    getLogger('monitor').info(`projects's length: ${projects.length}`);
    for (const project of projects) {
      try {
        const result = await axios.get(`${project.nodeEndpoint}/health`, {
          timeout: 5000,
        });
        if (result.data.status === 'ok') {
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
    getLogger('monitor').info(`check node health finished`);
  }

  async restartUnhealthyNode() {
    let containersToRestart = [];
    for (const [id, times] of this.nodeUnhealthTimesMap) {
      if (times >= this.nodeUnhealthTimes) {
        containersToRestart.push(nodeContainer(id));
      }
    }
    if (containersToRestart.length > 0) {
      getLogger('monitor').info(`restart unhealthy nodes: ${containersToRestart.join(',')}`);
      await this.docker.restart(containersToRestart);
    }
  }
}

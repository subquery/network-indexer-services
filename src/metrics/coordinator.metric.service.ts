// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import Docker from 'dockerode';
import { bytesToMegabytes } from '../utils/docker';
import { ContainerStatus, Images, Metric, metricNameMap } from './events';

@Injectable()
export class CoordinatorMetricsService implements OnModuleInit {
  private docker: Docker;
  constructor(protected eventEmitter: EventEmitter2) {
    this.docker = new Docker();
  }

  onModuleInit() {
    void this.pushServiceVersions();
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleCron() {
    await this.fetchAllContainersStats();
  }

  async fetchAllContainersStats() {
    // { all : false } excludes stopped containers
    const containers = await this.docker.listContainers({ all: true });
    for (const containerInfo of containers) {
      const container = this.docker.getContainer(containerInfo.Id);
      const data = await container.inspect();

      const [image] = data.Config.Image.split(':');
      const metric = metricNameMap[image as Images];
      if (!metric) return;

      const status = this.fetchContainerStatus(data);
      const stats = await this.fecthContainerCPUandMemoryUsage(container);
      this.eventEmitter.emit(metric, {
        cpu_usage: stats.cpuUsage,
        memory_usage: stats.memoryUsage,
        status,
      });
    }
  }

  fetchContainerStatus(data: Docker.ContainerInspectInfo): ContainerStatus {
    const { Health, Restarting, ExitCode } = data.State;
    const health = Health?.Status;

    let status = ContainerStatus.dead;
    if (health && health === 'healthy') {
      status = ContainerStatus.healthy;
    } else if (Restarting) {
      status = ContainerStatus.restarting;
    } else if (!ExitCode) {
      status = ContainerStatus.exit;
    } else if (health && health === 'unhealthy') {
      status = ContainerStatus.unhealthy;
    }

    return status;
  }

  async fecthContainerCPUandMemoryUsage(container: Docker.Container) {
    const stats = await container.stats({ stream: false });

    const { cpu_stats, precpu_stats } = stats;
    const { total_usage: currTotalUsage } = cpu_stats.cpu_usage;
    const { total_usage: preTotalUsage } = precpu_stats.cpu_usage;
    const { system_cpu_usage: currSystemUsage } = cpu_stats;
    const { system_cpu_usage: preSystemUsage } = precpu_stats;

    let cpuUsage = 0;
    if (currSystemUsage && preSystemUsage) {
      // TODO: is it necessary to calculate cpu usage by delta?
      const cpuDelta = Math.abs(currTotalUsage - preTotalUsage);
      const systemDelta = Math.abs(currSystemUsage - preSystemUsage);
      cpuUsage = (cpuDelta / systemDelta) * 100;
    }

    let memoryUsage = 0;
    const { usage: _memoryUsage } = stats.memory_stats;
    if (_memoryUsage) {
      memoryUsage = bytesToMegabytes(stats.memory_stats.usage);
    }

    return { id: container.id, memoryUsage, cpuUsage };
  }

  async pushServiceVersions() {
    const containers = await this.docker.listContainers({ all: false });

    for (const containerInfo of containers) {
      const container = this.docker.getContainer(containerInfo.Id);
      const data = await container.inspect();

      const [image, tag] = data.Config.Image.split(':');

      if (image === Images.Coordinator && tag) {
        this.eventEmitter.emit(Metric.CoordinatorVersion, {
          coordinator_version: tag,
        });
      }

      if (image === Images.Proxy && tag) {
        this.eventEmitter.emit(Metric.ProxyVersion, {
          proxy_version: tag,
        });
      }
    }
  }
}

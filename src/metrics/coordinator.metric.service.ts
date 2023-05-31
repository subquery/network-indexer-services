// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Images, Metric, metricNameMap } from './events';
import Docker from 'dockerode';
import { bytesToMegabytes } from 'src/utils/docker';

@Injectable()
export class CoordinatorMetricsService implements OnModuleInit {
  private docker: Docker;
  constructor(protected eventEmitter: EventEmitter2) {
    this.docker = new Docker();
  }

  onModuleInit() {
    this.pushServiceVersions();
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleCron() {
    await this.fetchAllContainersStats();
  }

  public async fetchAllContainersStats() {
    // { all : false } excludes stopped containers
    const containers = await this.docker.listContainers({ all: false });
    for (const containerInfo of containers) {
      const container = this.docker.getContainer(containerInfo.Id);
      const data = await container.inspect();

      const [image] = data.Config.Image.split(':');
      const metric = metricNameMap[image as Images];
      if (!metric) return;

      const stats = await this.fetchContainerStats(container);
      this.eventEmitter.emit(metric, {
        cpu_usage: stats.cpuUsage,
        memory_usage: stats.memoryUsage,
      });
    }
  }

  // Function to fetch stats for a container
  public async fetchContainerStats(container: Docker.Container) {
    const stats = await container.stats({ stream: false });
    const memoryUsage = stats.memory_stats.usage;
    const { cpu_stats, precpu_stats } = stats;

    const cpuDelta = cpu_stats.cpu_usage.total_usage - precpu_stats.cpu_usage.total_usage;
    const systemDelta = cpu_stats.system_cpu_usage - precpu_stats.system_cpu_usage;
    const cpuUsagePercentage = (cpuDelta / systemDelta) * 100;

    return {
      id: container.id,
      memoryUsage: bytesToMegabytes(memoryUsage),
      cpuUsage: cpuUsagePercentage,
    };
  }

  public async pushServiceVersions() {
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

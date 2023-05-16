// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Metric } from './events';
import Docker from 'dockerode';
import { bytesToMegabytes } from 'src/utils/docker';

@Injectable()
export class CoordinatorMetricsService implements OnModuleInit {
  constructor(protected eventEmitter: EventEmitter2) {}

  onModuleInit() {
    this.pushServiceVersions();
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleCron() {
    await this.fetchAllContainersStats();
  }

  private getDockerMetricEnum(imageName: string): Metric | undefined {
    const metricNameMap: Record<string, Metric> = {
      'onfinality/subql-indexer-proxy': Metric.ProxyDockerStats,
      postgres: Metric.DbDockerStats,
      'onfinality/subql-coordinator': Metric.CoordinatorDockerStats,
    };
    return metricNameMap[imageName];
  }

  public async fetchAllContainersStats() {
    const docker = new Docker();
    const containers = await docker.listContainers({ all: false }); // { all : false } excludes stopped containers
    for (const containerInfo of containers) {
      const container = docker.getContainer(containerInfo.Id);
      const data = await container.inspect();

      const [image] = data.Config.Image.split(':');
      const metric = this.getDockerMetricEnum(image);
      if (metric) {
        const stats = await this.fetchContainerStats(container);
        this.eventEmitter.emit(metric, {
          cpu_usage: stats.cpuUsage,
          memory_usage: stats.memoryUsage,
        });
      }
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
    const docker = new Docker();
    const containers = await docker.listContainers({ all: false });

    for (const containerInfo of containers) {
      const container = docker.getContainer(containerInfo.Id);
      const data = await container.inspect();

      const [image, tag] = data.Config.Image.split(':');

      if (image === 'onfinality/subql-coordinator' && tag) {
        this.eventEmitter.emit(Metric.CoordinatorVersion, {
          coordinator_version: tag,
        });
      }

      if (image === 'onfinality/subql-indexer-proxy' && tag) {
        this.eventEmitter.emit(Metric.ProxyVersion, {
          proxy_version: tag,
        });
      }
    }
  }
}

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
    // this.pushServiceVersions();
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleCron() {
    await this.fetchAllContainersStats();
  }

  public async fetchAllContainersStats() {
    const docker = new Docker();
    const containers = await docker.listContainers();
    for (const containerInfo of containers) {
      const container = docker.getContainer(containerInfo.Id);
      const data = await container.inspect();

      const parts = data.Config.Image.split(':');
      const image = parts[0];
      const metric = this.getMetricEnum(image);
      if (metric) {
        const stats = await this.fetchContainerStats(container);
        this.eventEmitter.emit(metric, {
          cpu_usage: stats.cpuUsage,
          memory_usage: stats.memoryUsage,
        });
      }
    }
  }

  private getMetricEnum(imageName: string): Metric | undefined {
    const metricNameMap: Record<string, Metric> = {
      'onfinality/subql-indexer-proxy': Metric.ProxyDockerStats,
      postgres: Metric.DbDockerStats,
      'onfinality/subql-coordinator': Metric.CoordinatorDockerStats,
    };
    return metricNameMap[imageName];
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

  //TODO: fetch queries served from proxy
  // public async pushServiceVersions() {
  //   this.eventEmitter.emit(Metric.IndexerServicesVersions, {
  //     coordinator_version: '',
  //     proxy_version: '',
  //   });
  // }
}

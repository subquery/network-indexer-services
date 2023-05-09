// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable, OnModuleInit } from '@nestjs/common';
import { AccountService } from 'src/account/account.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Metric } from './events';
import Docker from 'dockerode';

@Injectable()
export class CoordinatorMetricsService implements OnModuleInit {
  constructor(private accountService: AccountService, protected eventEmitter: EventEmitter2) {}

  onModuleInit() {
    //TODO: Try emit version updates
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleCron() {
    await this.fetchAllContainersStats();
    // await this.pushServiceInfo();
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

  // Function to fetch stats for an individual container using its ID
  public async fetchContainerStatsById(containerId: string) {
    const docker = new Docker();
    const container = docker.getContainer(containerId);
    await this.fetchContainerStats(container);
  }

  // Function to fetch stats for a container
  public async fetchContainerStats(container: Docker.Container) {
    const stats = await container.stats({ stream: false });
    const memoryUsage = stats.memory_stats.usage;
    const { cpu_stats, precpu_stats } = stats;

    const cpuDelta = cpu_stats.cpu_usage.total_usage - precpu_stats.cpu_usage.total_usage;
    const systemCpuDelta = cpu_stats.system_cpu_usage - precpu_stats.system_cpu_usage;
    const cpuUsage = (cpuDelta / systemCpuDelta) * (cpu_stats.cpu_usage.percpu_usage?.length ?? 0) * 100;
    //TODO: there is something wrong with cpu usage

    return {
      id: container.id,
      memoryUsage: this.bytesToMegabytes(memoryUsage),
      cpuUsage: cpuUsage,
    };
  }

  // Function to convert bytes to megabytes
  public bytesToMegabytes(bytes: number) {
    return bytes / (1024 * 1024);
  }

  // public async pushServiceInfo() {
  //   const indexer = await this.accountService.getIndexer();
  //   if (!indexer) return;

  // this.eventEmitter.emit(SetMetricEvent.CoordinatorVersion, {
  //   value: version,
  //   indexer,
  // });
  // }

  //TODO: fetch queries served from proxy
}

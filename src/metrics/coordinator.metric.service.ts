// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { AccountService } from 'src/account/account.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SetMetricEvent } from './events';
import Docker from 'dockerode';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../../package.json');

@Injectable()
export class CoordinatorMetricsService {
  constructor(private accountService: AccountService, protected eventEmitter: EventEmitter2) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleCron() {
    await this.fetchAllContainersStats();
    await this.pushServiceInfo();
  }

  public async fetchAllContainersStats() {
    const docker = new Docker();
    const containers = await docker.listContainers();
    for (const containerInfo of containers) {
      const container = docker.getContainer(containerInfo.Id);
      await this.fetchContainerStats(container);
    }
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
    const containerInfo = await container.inspect();

    // Calculate memory usage in bytes
    const memoryUsage = stats.memory_stats.usage;

    // Calculate CPU usage in percentage
    const { cpu_stats, precpu_stats } = stats;

    const cpuDelta = cpu_stats.cpu_usage.total_usage - precpu_stats.cpu_usage.total_usage;
    const systemCpuDelta = cpu_stats.system_cpu_usage - precpu_stats.system_cpu_usage;
    const cpuUsage = (cpuDelta / systemCpuDelta) * (cpu_stats.cpu_usage.percpu_usage?.length ?? 0) * 100;

    console.log(containerInfo.Name);
    console.log('Container ID:', container.id);
    console.log('Memory Usage (MB):', this.bytesToMegabytes(memoryUsage));
    console.log('CPU Usage (%):', cpuUsage.toFixed(2));
    //TODO: need to emit the variables
  }

  // Function to convert bytes to megabytes
  public bytesToMegabytes(bytes: number) {
    return bytes / (1024 * 1024);
  }

  public async pushServiceInfo() {
    const indexer = await this.accountService.getIndexer();
    if (!indexer) return;

    this.eventEmitter.emit(SetMetricEvent.CoordinatorVersion, {
      value: version,
      indexer,
    });
  }
}

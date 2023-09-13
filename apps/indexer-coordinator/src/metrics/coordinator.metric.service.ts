// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
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

  @Cron(CronExpression.EVERY_5_MINUTES)
  handleVersionsCron() {
    void this.pushServiceVersions();
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleCron() {
    await this.fetchAllContainersStats();
  }

  async fetchAllContainersStats() {
    const containers = await this.docker.listContainers();

    await Promise.all(containers.map(async container => {
      const { Id, Image } = container;
      const [image] = Image.split(':');
      const metric = metricNameMap[image as Images];
      if (!metric) return;

      const containerDetails = this.docker.getContainer(Id);
      const data = await containerDetails.inspect();
      const status = this.fetchContainerStatus(data);
      const stats = await this.fetchContainerCPUandMemoryUsage(containerDetails);
      this.eventEmitter.emit(metric, {
        cpu_usage: stats.cpuUsage,
        memory_usage: stats.memoryUsage,
        status,
      });
    }));
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

  async fetchContainerCPUandMemoryUsage(container: Docker.Container) {
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
    const containers = await this.docker.listContainers();

    containers.map((container) => {
      const { Image } = container;
      const [image, tag] = Image.split(':');

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
    });
  }
}

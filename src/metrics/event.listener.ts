// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Gauge } from 'prom-client';

import { ContainerStatus, DockerEventPayload, Metric, cpuMetric, memoryMetric, statusMetric } from './events';

@Injectable()
export class MetricEventListener {
  constructor(
    @InjectMetric(Metric.CoordinatorVersion)
    private coordinatorVersion: Gauge<string>,
    @InjectMetric(cpuMetric(Metric.CoordinatorDockerStats))
    private coordinatorDockerCpu: Gauge<string>,
    @InjectMetric(memoryMetric(Metric.CoordinatorDockerStats))
    private coordinatorDockerMemory: Gauge<string>,
    @InjectMetric(statusMetric(Metric.CoordinatorDockerStats))
    private coordinatorDockerStatus: Gauge<string>,

    @InjectMetric(Metric.ProxyVersion)
    private proxyVersion: Gauge<string>,
    @InjectMetric(memoryMetric(Metric.ProxyDockerStats))
    private proxyDockerMemory: Gauge<string>,
    @InjectMetric(cpuMetric(Metric.ProxyDockerStats))
    private proxyDockerCpu: Gauge<string>,
    @InjectMetric(statusMetric(Metric.ProxyDockerStats))
    private proxyDockerStatus: Gauge<string>,

    @InjectMetric(memoryMetric(Metric.DbDockerStats))
    private dbDockerMemory: Gauge<string>,
    @InjectMetric(cpuMetric(Metric.DbDockerStats))
    private dbDockerCpu: Gauge<string>,
    @InjectMetric(statusMetric(Metric.DbDockerStats))
    private dbDockerStatus: Gauge<string>,
  ) {}

  @OnEvent(Metric.CoordinatorVersion)
  handleCoordinatorVersions({ coordinator_version }: { coordinator_version: string }) {
    this.coordinatorVersion.labels({ coordinator_version }).set(1);
  }

  @OnEvent(Metric.ProxyVersion)
  handleProxyVersion({ proxy_version }: { proxy_version: string }) {
    this.proxyVersion.labels({ proxy_version }).set(1);
  }

  @OnEvent(Metric.ProxyDockerStats)
  handleProxyStats({ cpu_usage, memory_usage, status }: DockerEventPayload) {
    this.handleDockerStats(
      this.proxyDockerCpu,
      this.proxyDockerMemory,
      this.proxyDockerStatus,
      cpu_usage,
      memory_usage,
      status,
    );
  }

  @OnEvent(Metric.CoordinatorDockerStats)
  handleCoordinatorStats({ cpu_usage, memory_usage, status }: DockerEventPayload) {
    this.handleDockerStats(
      this.coordinatorDockerCpu,
      this.coordinatorDockerMemory,
      this.coordinatorDockerStatus,
      cpu_usage,
      memory_usage,
      status,
    );
  }

  @OnEvent(Metric.DbDockerStats)
  handleDbStats({ cpu_usage, memory_usage, status }: DockerEventPayload) {
    this.handleDockerStats(
      this.dbDockerCpu,
      this.dbDockerMemory,
      this.dbDockerStatus,
      cpu_usage,
      memory_usage,
      status,
    );
  }

  private handleDockerStats(
    cpuGauge: Gauge<string>,
    memoryGauge: Gauge<string>,
    statusGuage: Gauge<string>,
    cpuUsage: string,
    memoryUsage: string,
    status: ContainerStatus,
  ) {
    cpuGauge.set(parseFloat(cpuUsage));
    memoryGauge.set(parseFloat(memoryUsage));
    statusGuage.set(status);
  }
}

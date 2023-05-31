// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { OnEvent } from '@nestjs/event-emitter';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Gauge } from 'prom-client';
import { Injectable } from '@nestjs/common';

import { DockerEventPayload, Metric, cpuMetric, memoryMetric } from './events';

@Injectable()
export class MetricEventListener {
  constructor(
    @InjectMetric(Metric.CoordinatorVersion)
    private coordinatorVersion: Gauge<string>,
    @InjectMetric(Metric.ProxyVersion)
    private proxyVersion: Gauge<string>,
    @InjectMetric(memoryMetric(Metric.ProxyDockerStats))
    private proxyDockerMemory: Gauge<string>,
    @InjectMetric(cpuMetric(Metric.ProxyDockerStats))
    private proxyDockerCpu: Gauge<string>,
    @InjectMetric(memoryMetric(Metric.CoordinatorDockerStats))
    private coordinatorDockerMemory: Gauge<string>,
    @InjectMetric(cpuMetric(Metric.CoordinatorDockerStats))
    private coordinatorDockerCpu: Gauge<string>,
    @InjectMetric(memoryMetric(Metric.DbDockerStats))
    private dbDockerMemory: Gauge<string>,
    @InjectMetric(cpuMetric(Metric.DbDockerStats))
    private dbDockerCpu: Gauge<string>,
  ) {}

  @OnEvent(Metric.CoordinatorVersion)
  async handleCoordinatorVersions({ coordinator_version }: { coordinator_version: string }) {
    this.coordinatorVersion.labels({ coordinator_version }).set(1);
  }

  @OnEvent(Metric.ProxyVersion)
  async handleProxyVersion({ proxy_version }: { proxy_version: string }) {
    this.proxyVersion.labels({ proxy_version }).set(1);
  }

  @OnEvent(Metric.ProxyDockerStats)
  async handleProxyStats({ cpu_usage, memory_usage }: DockerEventPayload) {
    this.handleDockerStats(this.proxyDockerCpu, this.proxyDockerMemory, cpu_usage, memory_usage);
  }

  @OnEvent(Metric.CoordinatorDockerStats)
  async handleCoordinatorStats({ cpu_usage, memory_usage }: DockerEventPayload) {
    this.handleDockerStats(this.coordinatorDockerCpu, this.coordinatorDockerMemory, cpu_usage, memory_usage);
  }

  @OnEvent(Metric.DbDockerStats)
  async handleDbStats({ cpu_usage, memory_usage }: DockerEventPayload) {
    this.handleDockerStats(this.dbDockerCpu, this.dbDockerMemory, cpu_usage, memory_usage);
  }

  private handleDockerStats(
    cpuGauge: Gauge<string>,
    memoryGauge: Gauge<string>,
    cpu_usage: string,
    memory_usage: string,
  ) {
    cpuGauge.set(parseFloat(cpu_usage));
    memoryGauge.set(parseFloat(memory_usage));
  }
}

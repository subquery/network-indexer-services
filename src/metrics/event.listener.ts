// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { OnEvent } from '@nestjs/event-emitter';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Gauge } from 'prom-client';
import { DockerEventPayload, IndexerQueriesPayload, Metric, ServicesVersionsPayload } from './events';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MetricEventListener {
  constructor(
    @InjectMetric(Metric.IndexerServicesVersions)
    private serviceDetails: Gauge<string>,
    @InjectMetric(Metric.ProxyDockerStats)
    private proxyDockerStats: Gauge<string>,
    @InjectMetric(Metric.CoordinatorDockerStats)
    private coordinatorDockerStats: Gauge<string>,
    @InjectMetric(Metric.DbDockerStats)
    private dbDockerStats: Gauge<string>,
    @InjectMetric(Metric.IndexerQueriesServed)
    private indexerQueriesServed: Gauge<string>,
  ) {}

  //TODO: serviceDetailsVersions event handler

  @OnEvent(Metric.IndexerServicesVersions)
  async handleIndexerVersions({ coordinator_version, proxy_version }: ServicesVersionsPayload) {
    this.serviceDetails.labels({ coordinator_version, proxy_version }).set(1);
  }

  @OnEvent(Metric.ProxyDockerStats)
  async handleCoordinatorStats({ cpu_usage, memory_usage }: DockerEventPayload) {
    this.proxyDockerStats.labels({ cpu_usage, memory_usage }).set(1);
  }

  @OnEvent(Metric.CoordinatorDockerStats)
  async handleProxyStats({ cpu_usage, memory_usage }: DockerEventPayload) {
    this.coordinatorDockerStats.labels({ cpu_usage, memory_usage }).set(1);
  }

  @OnEvent(Metric.DbDockerStats)
  async handleDbStats({ cpu_usage, memory_usage }: DockerEventPayload) {
    this.dbDockerStats.labels({ cpu_usage, memory_usage }).set(1);
  }

  @OnEvent(Metric.IndexerQueriesServed)
  async handleIndexerQueriesServed({ queriesServed }: IndexerQueriesPayload) {
    this.indexerQueriesServed.labels({ queriesServed }).set(1);
  }
}

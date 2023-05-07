// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';
import { makeCounterProvider, makeGaugeProvider, PrometheusModule } from '@willsoto/nestjs-prometheus';

import { AccountModule } from 'src/account/account.module';
import { ServicesModule } from 'src/services/services.module';
import { CoordinatorMetricsService } from './coordinator.metric.service';
import { MetricEventListener } from './event.listener';
import { Metric } from './events';
import { MetricsResolver } from './metrics.resolver';
import { VersionsService } from './versions.service';

@Module({
  imports: [
    PrometheusModule.register({
      path: 'metrics',
      defaultMetrics: { enabled: false },
    }),
    AccountModule,
    ServicesModule,
  ],
  providers: [
    MetricEventListener,
    VersionsService,
    MetricsResolver,
    makeGaugeProvider({
      name: Metric.IndexerServicesVersions,
      help: 'indexer services versions',
      labelNames: ['coordinator_version', 'proxy_version'],
    }),
    makeGaugeProvider({
      name: Metric.ProxyDockerStats,
      help: 'indexer proxy docker stats',
      labelNames: ['cpu_usage', 'memory_usage'],
    }),
    makeGaugeProvider({
      name: Metric.CoordinatorDockerStats,
      help: 'indexer coordinator docker stats',
      labelNames: ['cpu_usage', 'memory_usage'],
    }),
    makeGaugeProvider({
      name: Metric.DbDockerStats,
      help: 'postgres database docker stats',
      labelNames: ['cpu_usage', 'memory_usage'],
    }),
    makeCounterProvider({
      name: Metric.IndexerQueriesServed,
      help: 'indexer queries served',
      labelNames: ['queries'],
    }),
    CoordinatorMetricsService,
  ],
})
export class MetricsModule {}

// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { CoreModule } from '../core/core.module';
import { CoordinatorMetricsService } from './coordinator.metric.service';
import { MetricEventListener } from './event.listener';
import { MetricsResolver } from './metrics.resolver';
import { PrometheusProviders } from './promProviders';
import { VersionsService } from './versions.service';

@Module({
  imports: [
    PrometheusModule.register({
      path: 'metrics',
      defaultMetrics: { enabled: false },
    }),
    CoreModule,
  ],
  providers: [
    MetricEventListener,
    VersionsService,
    MetricsResolver,
    ...PrometheusProviders,
    CoordinatorMetricsService,
  ],
})
export class MetricsModule {}

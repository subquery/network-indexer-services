// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';
import { makeGaugeProvider, PrometheusModule } from '@willsoto/nestjs-prometheus';

import { AccountModule } from 'src/account/account.module';
import { ServicesModule } from 'src/services/services.module';
import { CoordinatorMetricsService } from './coordinator.metric.service';
import { MetricEventListener } from './event.listener';
import { metric, Metric } from './events';

@Module({
  imports: [
    PrometheusModule.register({
      defaultMetrics: { enabled: false },
    }),
    AccountModule,
    ServicesModule,
  ],
  providers: [
    MetricEventListener,
    makeGaugeProvider({
      name: metric(Metric.CoordinatorDetails),
      help: 'details about indexer coordinator',
      labelNames: ['coordinator_version', 'coordinator_balance'],
    }),
    CoordinatorMetricsService,
  ],
})
export class MetricsModule {}

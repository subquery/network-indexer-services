// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';
import { makeGaugeProvider, PrometheusModule } from '@willsoto/nestjs-prometheus';

import { AccountModule } from 'src/account/account.module';
import { ServicesModule } from 'src/services/services.module';
import { PublicMetricsService } from './public.metric.service';
import { metric, ServiceEvent } from './events';
import { MetricEventListener } from './event.listener';

@Module({
  imports: [PrometheusModule.register(), AccountModule, ServicesModule],
  providers: [
    MetricEventListener,
    makeGaugeProvider({
      name: metric(ServiceEvent.CoordinatorVersion),
      help: 'The coordiantor service version',
    }),
    makeGaugeProvider({
      name: metric(ServiceEvent.ControllerBalance),
      help: 'The coordiantor service version',
    }),
    PublicMetricsService,
  ],
  exports: [PublicMetricsService],
})
export class MetricsModule {}

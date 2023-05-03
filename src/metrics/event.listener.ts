// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { OnEvent } from '@nestjs/event-emitter';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Gauge } from 'prom-client';
import { EventPayload, metric, Metric, SetMetricEvent } from './events';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MetricEventListener {
  constructor(
    @InjectMetric(metric(Metric.CoordinatorDetails))
    private coordinatorDetails: Gauge<string>,
    @InjectMetric(metric('proxyMemoryUsage'))
    private proxyMemoryUsage: Gauge<string>,
    @InjectMetric(metric('proxyMemoryUsage'))
    private proxyCpuUsage: Gauge<string>,
    @InjectMetric(metric('coordinatorMemoryUsage'))
    private coordinatorMemoryUsage: Gauge<string>,
    @InjectMetric(metric('coordinatorCpuUsage'))
    private coordinatorCpuUsage: Gauge<string>,
    @InjectMetric(metric('dbMemoryUsage'))
    private dbMemoryUsage: Gauge<string>,
    @InjectMetric(metric('dbCpuUsage'))
    private dbCpuUsage: Gauge<string>,
  ) {}

  @OnEvent(SetMetricEvent.CoordinatorVersion)
  async handleCoordinatorVersion({ value }: EventPayload<string>) {
    this.coordinatorDetails.labels({ coordinator_version: value }).set(1);
  }
}

// TODO: add queries served
// @InjectMetric(metric('indexerQueriesServed'))
// private indexerQueriesServed: Counter<string>,

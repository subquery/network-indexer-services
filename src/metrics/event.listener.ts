// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { OnEvent } from '@nestjs/event-emitter';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Gauge } from 'prom-client';
import { EventPayload, metric, ServiceEvent } from './events';

// TODO: all metrics export to indexer

/// 1. `metadata`: for each indexing project, send this metric periodically (maybe 10min)-> instance: project_cid, labels: `metadta`
/// 2. `stats`: for docker containers ->  instance: container_name, labels: `metrics`
/// 3. `network status`: controllerBalance, rewardCollection (if currentEra - claimedEra > 1)

/// 4. `the disk used`: https://github.com/prometheus/node_exporter (low priority)

export class MetricEventListener {
  constructor(
    @InjectMetric(metric(ServiceEvent.CoordinatorVersion))
    private coordinatorVersion: Gauge<string>,
    @InjectMetric(metric(ServiceEvent.ControllerBalance))
    private controllreBalance: Gauge<string>,
  ) {}

  @OnEvent(ServiceEvent.CoordinatorVersion)
  handleCoordinatorVersion({ value }: EventPayload<number>) {
    this.coordinatorVersion.set(value);
  }

  @OnEvent(ServiceEvent.ControllerBalance)
  handlerControllerBalance({ value }: EventPayload<number>) {
    this.controllreBalance.set(value);
  }
}

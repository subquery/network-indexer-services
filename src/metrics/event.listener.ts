// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { OnEvent } from '@nestjs/event-emitter';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Gauge } from 'prom-client';
import { EventPayload, metric, ServiceEvent } from './events';

export class MetricEventListener {
  constructor(
    @InjectMetric(metric(ServiceEvent.CoordinatorVersion))
    private coordinatorVersion: Gauge<string>,
    @InjectMetric(metric(ServiceEvent.ControllerBalance))
    private controllerBalance: Gauge<string>,
  ) {}

  @OnEvent(ServiceEvent.CoordinatorVersion)
  handleCoordinatorVersion({ value }: EventPayload<number>) {
    this.coordinatorVersion.set(value);
  }

  @OnEvent(ServiceEvent.ControllerBalance)
  handlerControllerBalance({ value }: EventPayload<number>) {
    this.controllerBalance.set(value);
  }
}

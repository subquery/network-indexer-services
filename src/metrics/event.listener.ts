// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Pushgateway } from 'prom-client';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Gauge } from 'prom-client';
import { EventPayload, metric, Metric, SetMetricEvent } from './events';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Config } from 'src/configure/configure.module';

@Injectable()
export class MetricEventListener implements OnModuleInit {
  private pushGateway: Pushgateway;

  constructor(
    @InjectMetric(metric(Metric.CoordinatorDetails))
    private coordinatorDetails: Gauge<string>,
    private config: Config,
  ) {}

  onModuleInit() {
    this.pushGateway = new Pushgateway(this.config.pushGateway);
  }

  @OnEvent(SetMetricEvent.CoordinatorVersion)
  async handleCoordinatorVersion({ value, indexer }: EventPayload<string>) {
    this.coordinatorDetails.labels({ coordinator_version: value }).set(1);
    //TODO: configure prometheus to scrape instead of pushAdd
    await this.pushGateway.pushAdd({
      jobName: metric('service'),
      groupings: { instance: indexer },
    });
  }
}

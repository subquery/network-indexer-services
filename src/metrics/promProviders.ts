// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { makeCounterProvider, makeGaugeProvider } from '@willsoto/nestjs-prometheus';
import { Metric, cpuMetric, memoryMetric } from './events';

export const PrometheusProviders = [
  makeGaugeProvider({
    name: Metric.IndexerServicesVersions,
    help: 'indexer services versions',
    labelNames: ['coordinator_version', 'proxy_version'],
  }),
  makeGaugeProvider({
    name: cpuMetric(Metric.ProxyDockerStats),
    help: 'indexer proxy cpu docker stats',
  }),
  makeGaugeProvider({
    name: memoryMetric(Metric.ProxyDockerStats),
    help: 'indexer proxy memory docker stats',
  }),
  makeGaugeProvider({
    name: cpuMetric(Metric.CoordinatorDockerStats),
    help: 'indexer coordinator cpu docker stats',
  }),
  makeGaugeProvider({
    name: memoryMetric(Metric.CoordinatorDockerStats),
    help: 'indexer coordinator memory docker stats',
  }),
  makeGaugeProvider({
    name: cpuMetric(Metric.DbDockerStats),
    help: 'postgres database cpu docker stats',
  }),
  makeGaugeProvider({
    name: memoryMetric(Metric.DbDockerStats),
    help: 'postgres database memory docker stats',
  }),
  makeCounterProvider({
    name: Metric.IndexerQueriesServed,
    help: 'indexer queries served',
  }),
];

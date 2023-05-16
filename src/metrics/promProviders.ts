// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { makeCounterProvider, makeGaugeProvider } from '@willsoto/nestjs-prometheus';
import { Metric, cpuMetric, memoryMetric } from './events';

export const PrometheusProviders = [
  makeGaugeProvider({
    name: Metric.CoordinatorVersion,
    help: 'Indexer Coordinator version',
    labelNames: ['coordinator_version'],
  }),
  makeGaugeProvider({
    name: Metric.ProxyVersion,
    help: 'Indexer Proxy version',
    labelNames: ['proxy_version'],
  }),
  makeGaugeProvider({
    name: cpuMetric(Metric.ProxyDockerStats),
    help: 'Indexer proxy cpu usage (%)',
  }),
  makeGaugeProvider({
    name: memoryMetric(Metric.ProxyDockerStats),
    help: 'Indexer proxy memory usage (MB)',
  }),
  makeGaugeProvider({
    name: cpuMetric(Metric.CoordinatorDockerStats),
    help: 'Indexer coordinator cpu usage (%)',
  }),
  makeGaugeProvider({
    name: memoryMetric(Metric.CoordinatorDockerStats),
    help: 'Indexer coordinator memory usage (MB)',
  }),
  makeGaugeProvider({
    name: cpuMetric(Metric.DbDockerStats),
    help: 'Postgres database cpu usage (%)',
  }),
  makeGaugeProvider({
    name: memoryMetric(Metric.DbDockerStats),
    help: 'Postgres database memory usage (MB)',
  }),
  makeCounterProvider({
    name: Metric.IndexerQueriesServed,
    help: 'Indexer queries served',
  }),
];

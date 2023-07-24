// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { makeGaugeProvider } from '@willsoto/nestjs-prometheus';
import { Metric, cpuMetric, memoryMetric, statusMetric } from './events';

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
    name: statusMetric(Metric.ProxyDockerStats),
    help: 'Indexer proxy container status',
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
    name: statusMetric(Metric.CoordinatorDockerStats),
    help: 'Indexer coordinator container status',
  }),
  makeGaugeProvider({
    name: cpuMetric(Metric.DbDockerStats),
    help: 'DB cpu usage (%)',
  }),
  makeGaugeProvider({
    name: memoryMetric(Metric.DbDockerStats),
    help: 'DB memory usage (MB)',
  }),
  makeGaugeProvider({
    name: statusMetric(Metric.DbDockerStats),
    help: 'Indexer DB container status',
  }),
  makeGaugeProvider({
    name: cpuMetric(Metric.RedisDockerStats),
    help: 'Redis cpu usage (%)',
  }),
  makeGaugeProvider({
    name: memoryMetric(Metric.RedisDockerStats),
    help: 'Redis memory usage (MB)',
  }),
  makeGaugeProvider({
    name: statusMetric(Metric.RedisDockerStats),
    help: 'Redis container status',
  }),
];

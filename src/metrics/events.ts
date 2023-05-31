// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

export enum Images {
  Coordinator = 'onfinality/subql-coordinator',
  Proxy = 'onfinality/subql-indexer-proxy',
  Db = 'postgres',
}

export enum Metric {
  CoordinatorVersion = 'coordinator_version',
  ProxyVersion = 'proxy_version',
  ProxyDockerStats = 'proxy_docker_stats',
  CoordinatorDockerStats = 'coordinator_docker_stats',
  DbDockerStats = 'db_docker_stats',
  IndexerQueriesServed = 'indexer_queries_served',
}

export const metricNameMap: Record<Images, Metric> = {
  [Images.Coordinator]: Metric.CoordinatorDockerStats,
  [Images.Proxy]: Metric.ProxyDockerStats,
  [Images.Db]: Metric.DbDockerStats,
};

export interface DockerEventPayload {
  cpu_usage: string;
  memory_usage: string;
}

const metricPrefix = 'subql_indexer';

export function metric(name: string): string {
  return `${metricPrefix}_${name}`;
}

export function cpuMetric(metric: Metric): string {
  return `${metric}_cpu`;
}

export function memoryMetric(metric: Metric): string {
  return `${metric}_memory`;
}

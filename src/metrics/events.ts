// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

export enum Images {
  Coordinator = 'onfinality/subql-coordinator',
  Proxy = 'onfinality/subql-indexer-proxy',
  Db = 'postgres',
  Redis = 'redis',
}

export enum Metric {
  CoordinatorVersion = 'coordinator_version',
  ProxyVersion = 'proxy_version',
  ProxyDockerStats = 'proxy_docker_stats',
  CoordinatorDockerStats = 'coordinator_docker_stats',
  DbDockerStats = 'db_docker_stats',
  RedisDockerStats = 'redis_docker_stats',
}

export const metricNameMap: Record<Images, Metric> = {
  [Images.Coordinator]: Metric.CoordinatorDockerStats,
  [Images.Proxy]: Metric.ProxyDockerStats,
  [Images.Db]: Metric.DbDockerStats,
  [Images.Redis]: Metric.RedisDockerStats,
};

export enum ContainerStatus {
  exit = 1,
  dead,
  paused,
  restarting,
  unhealthy,
  healthy,
}

export interface DockerEventPayload {
  cpu_usage: string;
  memory_usage: string;
  status: ContainerStatus;
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

export function statusMetric(metric: Metric): string {
  return `${metric}_status`;
}

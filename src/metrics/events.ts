// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

const metricPrefix = 'subql_indexer';

export function metric(name: string): string {
  return `${metricPrefix}_${name}`;
}

export enum Metric {
  IndexerServicesVersions = 'services_details',
  ProxyDockerStats = 'proxy_docker_stats',
  CoordinatorDockerStats = 'coordinator_docker_stats',
  DbDockerStats = 'db_docker_stats',
  IndexerQueriesServed = 'indexer_queries_served',
}

export interface ServicesVersionsPayload {
  coordinator_version: string;
  proxy_version: string;
}

export interface DockerEventPayload {
  cpu_usage: string;
  memory_usage: string;
}

export interface IndexerQueriesPayload {
  queriesServed: number;
}

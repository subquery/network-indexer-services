// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

const metricPrefix = 'subql_indexer';

export function metric(name: string): string {
  return `${metricPrefix}_${name}`;
}

export enum Metric {
  CoordinatorDetails = 'coordinator_details',
}

export enum SetMetricEvent {
  CoordinatorBalance = 'coordinator_balance',
  CoordinatorVersion = 'coordinator_version',
}

export interface EventPayload<T> {
  value: T;
  indexer: string;
}

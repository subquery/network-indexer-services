// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

const metricPrefix = 'subql_indexer';

export function metric(name: string): string {
  return `${metricPrefix}_${name}`;
}

export enum ServiceEvent {
  CoordinatorVersion = 'coordinator_version',
  ControllerBalance = 'controller_balance',
}

export interface EventPayload<T> {
  value: T;
}

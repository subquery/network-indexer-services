// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ServiceStatus } from 'pages/project-details/types';

export enum ServiceStatus {
  healthy = 'HEALTHY',
  unhealthy = 'UNHEALTHY',
  terminated = 'TERMINATED',
}

export function statusCode(status: string): 'success' | 'error' {
  if (status === 'HEALTHY' || status === 'STARTING') return 'success';
  return 'error';
}

export function indexingStatusCode(status: ServiceStatus) {
  switch (status) {
    case ServiceStatus.NOTINDEXING:
      return 'error';
    case ServiceStatus.INDEXING:
      return 'info';
    case ServiceStatus.READY:
      return 'success';
    default:
      return 'error';
  }
}

export function projectId(cid: string): string {
  return cid.substring(0, 15).toLowerCase();
}

export function isTrue(value: boolean | string): boolean {
  return value === true || value === 'true';
}

export const wrapGqlUrl = ({ indexer, url }: { indexer: string; url: string }) => {
  const gqlProxy = import.meta.env.VITE_APP_GQL_PROXY;

  return new URL(`${indexer}/?to=${encodeURIComponent(url)}`, gqlProxy).toString();
};

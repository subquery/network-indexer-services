// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { IndexingStatus } from 'pages/project-details/types';

export enum ServiceStatus {
  healthy = 'HEALTHY',
  unhealthy = 'UNHEALTHY',
  terminated = 'TERMINATED',
}

export function calculateProgress(targetHeight: number, latestHeight: number): number {
  if (targetHeight === 0) return 0;
  if (latestHeight >= targetHeight) return 100;
  return Math.round((latestHeight * 100 * 100) / targetHeight) / 100;
}

export function statusCode(status: string): 'success' | 'error' {
  if (status === 'HEALTHY' || status === 'STARTING') return 'success';
  return 'error';
}

export function indexingStatusCode(status: IndexingStatus) {
  switch (status) {
    case IndexingStatus.NOTINDEXING:
      return 'error';
    case IndexingStatus.INDEXING:
      return 'info';
    case IndexingStatus.READY:
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

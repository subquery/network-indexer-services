// Copyright 2020-2025 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

export enum AccountNotification {
  MetadataUpated = 'MetadataUpated',
  ControllerUpdated = 'ControllerUpdated',
}

export enum ProjectNotification {
  NotIndexing = 'NotIndexing',
  Started = 'Started',
  Indexing = 'Indexing',
  Ready = 'Ready',
  Terminated = 'Terminated',
}

export enum TransactionNotification {
  Loading = 'Loading',
  Succeed = 'Succeed',
  Failed = 'Failed',
}

export const dismiss = (duration = 5000, onScreen = false) => ({
  duration,
  onScreen,
});

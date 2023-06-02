// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { BigNumber, ContractTransaction, Overrides } from 'ethers';

export enum IndexingStatus {
  NOTINDEXING,
  INDEXING,
  READY,
}

export type DeploymentStatus = {
  status: IndexingStatus;
  blockHeight: BigNumber;
};

export enum ServiceStatus {
  Starting = 'STARTING',
  Healthy = 'HEALTHY',
  UnHealthy = 'UNHEALTHY',
  NotStarted = 'NOT START',
  Terminated = 'TERMINATED',
}

export type TxFun = (overrides: Overrides) => Promise<ContractTransaction>;

export type Transaction = {
  name: string;
  txFun: TxFun;
  desc?: string;
};

export type PoiItem = {
  id: number;
  mmrRoot: string;
};

export type Poi = {
  blockHeight: number;
  mmrRoot: string;
};

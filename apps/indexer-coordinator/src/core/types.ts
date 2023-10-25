// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ContractTransaction, Overrides } from 'ethers';

export enum DesiredStatus {
  STOPPED,
  RUNNING,
}

export enum IndexerDeploymentStatus {
  TERMINATED,
  READY,
}

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

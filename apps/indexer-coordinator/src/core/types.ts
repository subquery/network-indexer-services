// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { BigNumber, ContractTransaction, Overrides } from 'ethers';

export enum DesiredStatus {
  STOPPED,
  RUNNING,
}

// export enum ProjectStatus {
//   NOTINDEXING,
//   READY,
// }

// export type DeploymentStatus = {
//   status: ProjectStatus;
//   blockHeight: BigNumber;
// };

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

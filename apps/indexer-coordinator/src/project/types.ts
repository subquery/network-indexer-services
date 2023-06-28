// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Postgres } from '../configure/configure.module';

export enum MmrStoreType {
  postgres = 'postgres',
  file = 'file',
}

export type TemplateType = {
  deploymentID: string;
  projectID: string;
  networkEndpoint: string;
  nodeVersion: string;
  queryVersion: string;
  servicePort: number;
  poiEnabled: boolean;
  mmrStoreType: MmrStoreType;
  networkDictionary?: string;
  dbSchema: string;
  postgres: Postgres;
  dockerNetwork: string;
  worker: number;
  batchSize: number;
  timeout: number;
  cache: number;
  cpu: number;
  memory: number;
};

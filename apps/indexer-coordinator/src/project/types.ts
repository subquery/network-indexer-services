// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Postgres } from '../configure/configure.module';

export enum MmrStoreType {
  postgres = 'postgres',
  file = 'file',
}

export enum ProjectType {
  SUBQUERY,
  RPC,
}

export enum SubqueryEndpointType {
  Node = 'nodeEndpoint',
  Query = 'queryEndpoint',
}

export type TemplateType = {
  deploymentID: string;
  projectID: string;
  networkEndpoints: string[];
  nodeVersion: string;
  queryVersion: string;
  servicePort: number;
  poiEnabled: boolean;
  mmrStoreType: MmrStoreType;
  networkDictionary?: string;
  dbSchema: string;
  postgres: Postgres;
  dockerNetwork: string;
  ipfsUrl: string;
  mmrPath: string;
  worker: number;
  batchSize: number;
  timeout: number;
  cache: number;
  cpu: number;
  memory: number;
  usePrimaryNetworkEndpoint?: boolean;
  primaryNetworkEndpoint?: string;
};

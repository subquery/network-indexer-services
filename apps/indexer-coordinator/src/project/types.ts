// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Postgres } from '../configure/configure.module';

export enum MmrStoreType {
  postgres = 'postgres',
  file = 'file',
}

export enum ProjectType {
  SUBQUERY,
  RPC,
  DICTIONARY,
  SUBGRAPH,
}

export enum HostType {
  UN_RESOLVED = 'un-resolved',
  SYSTEM_MANAGED = 'system-managed',
  USER_MANAGED = 'user-managed',
}

export enum AccessType {
  DEFAULT = 'default',
  INTERNAL = 'internal',
}

// export enum EndpointType {
//   DEFAULT = 'default',
//   WS = 'ws',
// }

export enum SubqueryEndpointType {
  Node = 'nodeEndpoint',
  Query = 'queryEndpoint',
  Admin = 'adminEndpoint',
}

export const SubqueryEndpointAccessType = {
  [SubqueryEndpointType.Node]: AccessType.INTERNAL,
  [SubqueryEndpointType.Query]: AccessType.DEFAULT,
  [SubqueryEndpointType.Admin]: AccessType.INTERNAL,
};

export enum SubgraphPortType {
  HttpPort = 'http-port',
  WsPort = 'ws-port',
  AdminPort = 'admin-port',
  IndexNodePort = 'index-node-port',
  MetricsPort = 'metrics-port',
}

export enum SubgraphEndpointType {
  HttpEndpoint = 'http-endpoint',
  WsEndpoint = 'ws-endpoint',
  AdminEndpoint = 'admin-endpoint',
  IndexNodeEndpoint = 'index-node-endpoint',
  MetricsEndpoint = 'metrics-endpoint',
}

export const SubgraphEndpointAccessType = {
  [SubgraphEndpointType.HttpEndpoint]: AccessType.DEFAULT,
  [SubgraphEndpointType.WsEndpoint]: AccessType.DEFAULT,
  [SubgraphEndpointType.AdminEndpoint]: AccessType.INTERNAL,
  [SubgraphEndpointType.IndexNodeEndpoint]: AccessType.INTERNAL,
  [SubgraphEndpointType.MetricsEndpoint]: AccessType.INTERNAL,
};

export enum RpcEndpointType {
  evmHttp = 'evmHttp',
  evmWs = 'evmWs',
  evmMetricsHttp = 'evmMetricsHttp',

  polkadotWs = 'polkadotWs',
  polkadotHttp = 'polkadotHttp',
  polkadotMetricsHttp = 'polkadotMetricsHttp',

  substrateWs = 'substrateWs',
  substrateHttp = 'substrateHttp',

  subqlDictWs = 'subql_dictWs',
  subqlDictHttp = 'subql_dictHttp',
  subqlDictMetricsHttp = 'subql_dictMetricsHttp',

  solanaHttp = 'solanaHttp',
  solanaWs = 'solanaWs',
  solanaMetricsHttp = 'solanaMetricsHttp',
}

export const RpcEndpointAccessType = {
  [RpcEndpointType.evmMetricsHttp]: AccessType.INTERNAL,
  [RpcEndpointType.polkadotMetricsHttp]: AccessType.INTERNAL,
  [RpcEndpointType.subqlDictMetricsHttp]: AccessType.INTERNAL,
  [RpcEndpointType.solanaMetricsHttp]: AccessType.INTERNAL,
};

@InputType('SubgraphPort')
@ObjectType('SubgraphPort')
export class SubgraphPort {
  @Field()
  key: SubgraphPortType;
  @Field()
  value: number;
}

@ObjectType('SubgraphEndpoint')
export class SubgraphEndpoint {
  @Field()
  key: SubgraphEndpointType;
  @Field()
  value: string;
}

@ObjectType('SubqueryEndpoint')
export class DbStatsStorageType {
  @Field()
  size: string;
  @Field()
  timestamp: number;
}

export class DbSizeResultType {
  size: number;
}

export type TemplateType = {
  deploymentID: string;
  projectID: string;
  networkEndpoints: string[];
  nodeVersion: string;
  queryVersion: string;
  dockerRegistry?: string;
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
  hostCertsPath?: string;
  certsPath?: string;
  pgCa?: string;
  pgKey?: string;
  pgCert?: string;
};

export enum ErrorLevel {
  none = '',
  warn = 'warn',
  error = 'error',
}

export class ValidateRpcEndpointError extends Error {
  level: string;
  constructor(message: string, level: string = ErrorLevel.none) {
    super(message);
    this.name = 'ValidateRpcEndpointError';
    this.level = level;
  }
}

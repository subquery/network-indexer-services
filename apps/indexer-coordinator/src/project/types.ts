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

export enum SubqueryEndpointType {
  Node = 'nodeEndpoint',
  Query = 'queryEndpoint',
  Admin = 'adminEndpoint',
}

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
  hostCertsPath?: string;
  certsPath?: string;
  pgCa?: string;
  pgKey?: string;
  pgCert?: string;
};

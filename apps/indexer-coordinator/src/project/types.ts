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
  LLM,
}

export enum IntegrationType {
  SUBGRAPH,
  LLM,
}

export enum LLMModelStatus {
  NOT_READY = 'notReady',
  NORMAL = 'normal',
  PULLING = 'pulling',
  LOADED = 'loaded',
}

@ObjectType()
export class LLMModelPullResult {
  @Field()
  name: string;
  @Field()
  status: string;
  @Field({ nullable: true })
  host?: string;
  @Field({ nullable: true })
  digest?: string;
  @Field({ nullable: true })
  total?: number;
  @Field({ nullable: true })
  completed?: number;
}

@ObjectType()
export class LLMModel {
  @Field()
  name: string;
  @Field({ nullable: true })
  size?: number;
  @Field({ nullable: true })
  digest?: string;
  @Field()
  status: LLMModelStatus;
  @Field({ nullable: true })
  pullStatus?: LLMModelPullResult;
}

@InputType()
@ObjectType()
export class LLMConfig {
  @Field()
  foo: string;
}

@InputType()
@ObjectType()
export class LLMExtra {
  @Field()
  bar: string;
}

@ObjectType()
export class LLMOngoingStreamRequestMeta {
  @Field()
  model: string;
  @Field()
  host: string;
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

export enum LLMEndpointType {
  ApiGenerateEndpoint = 'api-generate-endpoint',
}

export const SubgraphEndpointAccessType = {
  [SubgraphEndpointType.HttpEndpoint]: AccessType.DEFAULT,
  [SubgraphEndpointType.WsEndpoint]: AccessType.DEFAULT,
  [SubgraphEndpointType.AdminEndpoint]: AccessType.INTERNAL,
  [SubgraphEndpointType.IndexNodeEndpoint]: AccessType.INTERNAL,
  [SubgraphEndpointType.MetricsEndpoint]: AccessType.INTERNAL,
};

export const LLMEndpointAccessType = {
  [LLMEndpointType.ApiGenerateEndpoint]: AccessType.DEFAULT,
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

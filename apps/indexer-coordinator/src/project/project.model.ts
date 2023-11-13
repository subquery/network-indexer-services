// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Column, Entity, PrimaryColumn, BeforeInsert } from 'typeorm';
import { ProjectType } from './types';

// TODO: temp place to put these types
@ObjectType('ProjectInfo')
export class ProjectInfo {
  @Field()
  networkProjectId: string;
  @Field()
  name: string;
  @Field()
  owner: string;
  @Field({ nullable: true })
  image: string;
  @Field({ nullable: true })
  description: string;
  @Field({ nullable: true })
  websiteUrl: string;
  @Field({ nullable: true })
  codeUrl: string;
  @Field({ nullable: true })
  version: string;
  @Field({ nullable: true })
  createdTimestamp: string;
  @Field({ nullable: true })
  updatedTimestamp: string;
  @Field({ nullable: true })
  metadata: string;
}

@ObjectType('Log')
export class LogType {
  @Field()
  log: string;
}

@ObjectType('ValidationResponse')
export class ValidationResponse {
  @Field()
  valid: boolean;
  @Field()
  reason: string;
}

@ObjectType('Metadata')
export class MetadataType {
  @Field(() => Int)
  lastProcessedHeight: number;
  @Field()
  lastProcessedTimestamp: number;
  @Field(() => Int)
  startHeight: number;
  @Field(() => Int)
  targetHeight: number;
  @Field({ nullable: true })
  chain?: string;
  @Field({ nullable: true })
  specName?: string;
  @Field({ nullable: true })
  genesisHash?: string;
  @Field()
  indexerHealthy: boolean;
  @Field()
  indexerNodeVersion: string;
  @Field()
  queryNodeVersion: string;
  @Field()
  indexerStatus: string;
  @Field()
  queryStatus: string;
}

export interface IProjectBaseConfig {
  networkEndpoints: string[];
  networkDictionary: string;
  nodeVersion: string;
  queryVersion: string;
  usePrimaryNetworkEndpoint?: boolean;
}

export interface IProjectAdvancedConfig {
  poiEnabled: boolean;
  purgeDB?: boolean;
  timeout: number;
  worker: number;
  batchSize: number;
  cache: number;
  cpu: number;
  memory: number;
}

@InputType('ProjectBaseConfigInput')
@ObjectType('ProjectBaseConfig')
export class ProjectBaseConfig implements IProjectBaseConfig {
  @Field(() => [String])
  networkEndpoints: string[];
  @Field()
  networkDictionary: string;
  @Field()
  nodeVersion: string;
  @Field()
  queryVersion: string;
  @Field({ nullable: true, defaultValue: true })
  usePrimaryNetworkEndpoint?: boolean;
}

@InputType('ProjectAdvancedConfigInput')
@ObjectType('ProjectAdvancedConfig')
export class ProjectAdvancedConfig implements IProjectAdvancedConfig {
  @Field()
  poiEnabled: boolean;
  @Field({ nullable: true, defaultValue: false })
  purgeDB?: boolean;
  @Field(() => Int)
  timeout: number;
  @Field(() => Int)
  worker: number;
  @Field(() => Int)
  batchSize: number;
  @Field(() => Int)
  cache: number;
  @Field(() => Int)
  cpu: number;
  @Field(() => Int)
  memory: number;
}

export interface IProjectNetworkEndpoints {
  nodeEndpoint?: string;
  queryEndpoint?: string;
}

export interface IProjectRpcEndpoints {
  httpEndpoint?: string;
  wsEndpoint?: string;
}

export interface IProjectConfig {
  // subquery base config
  networkEndpoints: string[];
  networkDictionary: string;
  nodeVersion: string;
  queryVersion: string;
  usePrimaryNetworkEndpoint?: boolean;
  poiEnabled: boolean;
  // subquery advanced config
  purgeDB?: boolean;
  timeout: number;
  worker: number;
  batchSize: number;
  cache: number;
  cpu: number;
  memory: number;
  // rpc config
  serviceEndpoints: KeyValuePair[];
}

@InputType('ProjectConfigInput')
@ObjectType('ProjectConfig')
export class ProjectConfig implements IProjectConfig {
  // subquery base config
  @Field(() => [String])
  networkEndpoints: string[];
  @Field()
  networkDictionary: string;
  @Field()
  nodeVersion: string;
  @Field()
  queryVersion: string;
  @Field({ nullable: true, defaultValue: true })
  usePrimaryNetworkEndpoint?: boolean;
  @Field()
  poiEnabled: boolean;
  // subquery advanced config
  @Field({ nullable: true, defaultValue: false })
  purgeDB?: boolean;
  @Field(() => Int)
  timeout: number;
  @Field(() => Int)
  worker: number;
  @Field(() => Int)
  batchSize: number;
  @Field(() => Int)
  cache: number;
  @Field(() => Int)
  cpu: number;
  @Field(() => Int)
  memory: number;
  // rpc config
  @Field(() => [KeyValuePair])
  serviceEndpoints: KeyValuePair[];
}

const defaultBaseConfig: IProjectBaseConfig = {
  networkEndpoints: [],
  networkDictionary: '',
  nodeVersion: '',
  queryVersion: '',
  usePrimaryNetworkEndpoint: true,
};

const defaultAdvancedConfig: IProjectAdvancedConfig = {
  purgeDB: false,
  poiEnabled: true,
  timeout: 1800,
  worker: 2,
  batchSize: 50,
  cache: 300,
  cpu: 2,
  memory: 2046,
};

const defaultProjectConfig: IProjectConfig = {
  // subquery base config
  networkEndpoints: [],
  networkDictionary: '',
  nodeVersion: '',
  queryVersion: '',
  usePrimaryNetworkEndpoint: true,
  // subquery advanced config
  purgeDB: false,
  poiEnabled: true,
  timeout: 1800,
  worker: 2,
  batchSize: 50,
  cache: 300,
  cpu: 2,
  memory: 2046,
  // rpc config
  serviceEndpoints: [],
};

@InputType('KeyValuePairInput')
@ObjectType('KeyValuePair')
export class KeyValuePair {
  constructor(key: string, value: string) {
    this.key = key;
    this.value = value;
  }
  @Field()
  key: string;
  @Field()
  value: string;
}

@Entity()
@ObjectType()
export class ProjectEntity {
  @PrimaryColumn()
  @Field(() => ID)
  id: string; // deploymentId

  @Column()
  @Field()
  status: number;

  @Column({ default: '' })
  @Field()
  chainType: string;

  @Column({ default: ProjectType.SUBQUERY })
  @Field()
  projectType: ProjectType;

  @Column({ default: '' })
  @Field()
  nodeEndpoint: string; // endpoint of indexer service

  @Column({ default: '' })
  @Field()
  queryEndpoint: string; // endpoint of query service

  @Column('jsonb', { default: {} })
  @Field(() => [KeyValuePair], { nullable: true })
  serviceEndpoints: KeyValuePair[];

  @Column('jsonb', { default: {} })
  @Field(() => ProjectInfo)
  details: ProjectInfo;

  @Column('jsonb', { default: {} })
  manifest: any;

  @Column('jsonb', { default: defaultBaseConfig })
  @Field(() => ProjectBaseConfig)
  baseConfig: ProjectBaseConfig;

  @Column('jsonb', { default: defaultAdvancedConfig })
  @Field(() => ProjectAdvancedConfig)
  advancedConfig: ProjectAdvancedConfig;

  @Column('jsonb', { default: {} })
  projectConfig: ProjectConfig;
  @Field(() => String, { nullable: true })
  projectConfigStr: string;

  // Explicitly set default values for the fields, ignoring the default values set in the DB schema.
  @BeforeInsert()
  setupDefaultValuesOnInsert: () => void = () => {
    this.chainType = this.chainType ?? '';
    this.nodeEndpoint = this.nodeEndpoint ?? '';
    this.queryEndpoint = this.queryEndpoint ?? '';
    this.serviceEndpoints = this.serviceEndpoints ?? [];
    // @ts-ignore
    this.details = this.details ?? {};
    // @ts-ignore
    this.manifest = this.manifest ?? {};
    this.baseConfig = this.baseConfig ?? defaultBaseConfig;
    this.advancedConfig = this.advancedConfig ?? defaultAdvancedConfig;
    this.projectConfig = this.projectConfig ?? defaultProjectConfig;
  };
}

@InputType('PaygConfigInput')
@ObjectType('PaygConfig')
export class PaygConfig {
  @Field()
  price: string;
  @Field()
  expiration: number;
  @Field()
  threshold: number;
  @Field()
  overflow: number;
  @Field()
  token: string;
}

@Entity()
@ObjectType()
export class PaygEntity {
  @PrimaryColumn()
  @Field(() => ID)
  id: string;

  @Column({ default: '' })
  @Field()
  price: string;

  @Column({ default: 0 })
  @Field()
  expiration: number;

  @Column({ default: 100 })
  @Field()
  threshold: number;

  @Column({ default: 5 })
  @Field()
  overflow: number;

  @Column({ default: '' })
  @Field()
  token: string;
}

@ObjectType('Project')
export class Project extends ProjectEntity {}

@ObjectType('Payg')
export class Payg extends PaygEntity {}

@ObjectType('ProjectDetails')
export class ProjectDetails extends ProjectEntity {
  @Field(() => MetadataType)
  metadata: MetadataType;

  @Field(() => Payg)
  payg: Payg;
}

// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Column, Entity, PrimaryColumn } from 'typeorm';

@ObjectType('Log')
export class LogType {
  @Field()
  log: string;
}

@ObjectType('Metadata')
export class MetadataType {
  @Field(() => Int)
  lastProcessedHeight: number;

  @Field()
  lastProcessedTimestamp: string;

  @Field(() => Int)
  targetHeight: number;

  @Field()
  chain: string;

  @Field()
  specName: string;

  @Field()
  genesisHash: string;

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
  networkEndpoint: string;
  networkDictionary: string;
  nodeVersion: string;
  queryVersion: string;
}

export interface IProjectAdvancedConfig {
  poiEnabled: boolean;
  purgeDB: boolean;
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
  @Field()
  networkEndpoint: string;

  @Field()
  networkDictionary: string;

  @Field()
  nodeVersion: string;

  @Field()
  queryVersion: string;
}

@InputType('ProjectAdvancedConfigInput')
@ObjectType('ProjectAdvancedConfig')
export class ProjectAdvancedConfig implements IProjectAdvancedConfig {
  @Field()
  poiEnabled: boolean;

  @Field()
  purgeDB: boolean;

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

const defaultBaseConfig: IProjectBaseConfig = {
  networkEndpoint: '',
  networkDictionary: '',
  nodeVersion: '',
  queryVersion: '',
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

  @Column({ default: '' })
  @Field()
  nodeEndpoint: string; // endpoint of indexer service

  @Column({ default: '' })
  @Field()
  queryEndpoint: string; // endpoint of query service

  @Column('jsonb', { default: defaultBaseConfig })
  @Field(() => ProjectBaseConfig)
  baseConfig: ProjectBaseConfig;

  @Column('jsonb', { default: defaultAdvancedConfig })
  @Field(() => ProjectAdvancedConfig)
  advancedConfig: ProjectAdvancedConfig;
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
}

@ObjectType('Project')
export class Project extends ProjectEntity {}

@ObjectType('Payg')
export class Payg extends PaygEntity {}

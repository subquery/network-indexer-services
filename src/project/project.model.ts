// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Field, Int, ObjectType } from '@nestjs/graphql';
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
  forceStart: boolean;
  purgeDB: boolean;
  timeout: number;
  worker: number;
  batchSize: number;
  cache: number;
  cpu: number;
  memory: number;
}

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

@ObjectType('ProjectAdvancedConfig')
export class ProjectAdvancedConfig implements IProjectAdvancedConfig {
  @Field()
  poiEnabled: boolean;

  @Field()
  purgeDB: boolean;

  @Field()
  forceStart: boolean;

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
  forceStart: false,
  timeout: 1800,
  worker: 2,
  batchSize: 50,
  cache: 300,
  cpu: 2,
  memory: 2046,
};

@Entity()
export class ProjectEntity {
  @PrimaryColumn()
  id: string; // deploymentId

  @Column()
  status: number;

  @Column({ default: '' })
  chainType: string;

  @Column({ default: '' })
  nodeEndpoint: string; // endpoint of indexer service

  @Column({ default: '' })
  queryEndpoint: string; // endpoint of query service

  @Column('jsonb', { default: defaultBaseConfig })
  baseConfig: ProjectBaseConfig;

  @Column('jsonb', { default: defaultAdvancedConfig })
  advancedConfig: ProjectAdvancedConfig;
}

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
export class PaygEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  price: string;

  @Column()
  expiration: number;

  @Column({ default: 100 })
  threshold: number;

  @Column({ default: 5 })
  overflow: number;
}

@ObjectType('Project')
export class Project extends ProjectEntity {}

@ObjectType('Payg')
export class Payg extends PaygEntity {}

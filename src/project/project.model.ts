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
  poiEnabled: boolean;
  forceStart: boolean;
}

export interface IProjectAdvancedConfig {
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

  @Field()
  poiEnabled: boolean;

  @Field()
  forceStart: boolean;
}

@ObjectType('ProjectAdvancedConfig')
export class ProjectAdvancedConfig implements IProjectAdvancedConfig {
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

@Entity()
export class ProjectEntity {
  @PrimaryColumn()
  id: string; // deploymentId

  @Column()
  status: number;

  @Column({ default: '' })
  chainType: string;

  @Column()
  nodeEndpoint: string; // endpoint of indexer service

  @Column()
  queryEndpoint: string; // endpoint of query service

  @Column('jsonb', { default: {} })
  baseConfig: ProjectBaseConfig;

  @Column('jsonb', { default: {} })
  advancedConfig: ProjectAdvancedConfig;
}

@Entity()
export class PaygEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  projectId: string;

  @Column()
  price: string;

  @Column()
  expiration: number;

  @Column()
  threshold: number;

  @Column()
  overflow: number;
}

@ObjectType('Project')
export class ProjectType extends ProjectEntity {}

// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class Project {
  @PrimaryColumn()
  id: string; // deploymentId

  @Column()
  status: number;

  @Column({ default: '' })
  chainType: string;

  @Column()
  networkEndpoint: string;

  @Column({ default: '' })
  networkDictionary: string;

  @Column()
  nodeEndpoint: string; // endpoint of indexer service

  @Column()
  queryEndpoint: string; // endpoint of query service

  @Column({ default: '' })
  nodeVersion: string;

  @Column({ default: '' })
  queryVersion: string;

  @Column({ default: false })
  poiEnabled: boolean;

  @Column({ default: false })
  forceEnabled: boolean;

  @Column({ default: '' })
  paygPrice: string; // price of PAYG

  @Column({ default: 1000 })
  paygThreshold: number; // Threshold of PAYG

  @Column({ default: 5 })
  paygOverflow: number; // Overflow max conflict of PAYG
}

@ObjectType('Project')
export class ProjectType {
  @Field(() => ID)
  id: string;

  @Field(() => Int)
  status: number;

  @Field()
  networkEndpoint: string;

  @Field()
  networkDictionary: string;

  @Field()
  nodeEndpoint: string;

  @Field()
  queryEndpoint: string;

  @Field()
  nodeVersion: string;

  @Field()
  queryVersion: string;

  @Field()
  poiEnabled: boolean;

  @Field()
  forceEnabled: boolean;

  @Field()
  paygPrice: string;

  @Field()
  paygThreshold: number;

  @Field()
  paygOverflow: number;
}

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

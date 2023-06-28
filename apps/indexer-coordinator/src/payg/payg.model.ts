// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

export enum ChannelStatus {
  FINALIZED,
  OPEN,
  TERMINATING,
}

export class QueryState {
  id: string;
  spent: string;
  isFinal: boolean;
  indexerSign: string;
  consumerSign: string;
}

@Entity()
export class Channel {
  @PrimaryColumn()
  id: string; // channelId

  @Column()
  status: ChannelStatus;

  @Column()
  deploymentId: string;

  @Column()
  indexer: string;

  @Column()
  consumer: string;

  @Column({ default: '' })
  total: string;

  @Column({ default: '' })
  spent: string;

  @Column({ default: '' })
  onchain: string;

  @Column({ default: '' })
  remote: string;

  @Column({ default: '' })
  price: string;

  @Column()
  expiredAt: number;

  @Column()
  terminatedAt: number;

  @Column()
  terminateByIndexer: boolean;

  @Column({ default: false })
  lastFinal: boolean;

  @Column({ default: '' })
  lastIndexerSign: string;

  @Column({ default: '' })
  lastConsumerSign: string;
}

@ObjectType('Channel')
export class ChannelType {
  @Field(() => ID)
  id: string;

  @Field(() => Int)
  status: number;

  @Field()
  deploymentId: string;

  @Field()
  indexer: string;

  @Field()
  consumer: string;

  @Field()
  total: string;

  @Field()
  spent: string;

  @Field()
  onchain: string;

  @Field()
  remote: string;

  @Field()
  price: string;

  @Field()
  expiredAt: number;

  @Field()
  terminatedAt: number;

  @Field()
  terminateByIndexer: boolean;

  @Field()
  lastFinal: boolean;

  @Field()
  lastIndexerSign: string;

  @Field()
  lastConsumerSign: string;
}

@ObjectType('QueryState')
export class QueryType {
  @Field(() => ID)
  id: string;

  @Field()
  spent: string;

  @Field()
  isFinal: boolean;

  @Field()
  indexerSign: string;

  @Field()
  consumerSign: string;
}

@Entity()
export class ChannelLabor {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  deploymentId: string;

  @Column()
  indexer: string;

  @Column()
  total: string;

  @Column()
  createdAt: number;
}

@ObjectType('ChannelLabor')
export class ChannelLaborType {
  @Field(() => ID)
  id: number;

  @Field()
  deploymentId: string;

  @Field()
  indexer: string;

  @Field()
  total: string;

  @Field()
  createdAt: number;
}

@Entity()
export class ChainInfo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  value: string;
}

@ObjectType('ChainInfo')
export class ChainInfoType {
  @Field(() => ID)
  id: number;

  @Field()
  name: string;

  @Field()
  value: string;
}

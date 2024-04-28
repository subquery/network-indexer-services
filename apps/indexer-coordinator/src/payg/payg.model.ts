// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Field, ID, ObjectType } from '@nestjs/graphql';
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
@ObjectType('Channel')
export class Channel {
  @PrimaryColumn()
  @Field(() => ID)
  id: string; // channelId

  @Column()
  @Field()
  status: ChannelStatus;

  @Column()
  @Field()
  deploymentId: string;

  @Column()
  @Field()
  indexer: string;

  @Column()
  @Field()
  consumer: string;

  @Column({ default: '' })
  @Field()
  agent: string;

  @Column({ default: '' })
  @Field()
  total: string;

  @Column({ default: '' })
  @Field()
  spent: string;

  @Column({ default: '' })
  @Field()
  onchain: string;

  @Column({ default: '' })
  @Field()
  remote: string;

  @Column({ default: '' })
  @Field()
  price: string;

  @Column()
  @Field()
  expiredAt: number;

  @Column()
  @Field()
  terminatedAt: number;

  @Column()
  @Field()
  terminateByIndexer: boolean;

  @Column({ default: false })
  @Field()
  lastFinal: boolean;

  @Column({ default: '' })
  @Field()
  lastIndexerSign: string;

  @Column({ default: '' })
  @Field()
  lastConsumerSign: string;
}

@Entity()
@ObjectType('ChannelLabor')
export class ChannelLabor {
  @PrimaryGeneratedColumn()
  @Field(() => ID)
  id: number;

  @Column()
  @Field()
  deploymentId: string;

  @Column()
  @Field()
  indexer: string;

  @Column()
  @Field()
  total: string;

  @Column()
  @Field()
  createdAt: number;
}

@Entity()
@ObjectType('ChainInfo')
export class ChainInfo {
  @PrimaryGeneratedColumn()
  @Field(() => ID)
  id: number;

  @Column()
  @Field()
  name: string;

  @Column()
  @Field()
  value: string;
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

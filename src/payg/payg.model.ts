// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { Column, Entity, PrimaryColumn } from 'typeorm';

export enum ChannelStatus {
  FINALIZED,
  OPEN,
  CHALLENGE,
}

export class QueryState {
  id: string;
  count: number;
  isFinal: boolean;
  price: number;
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
  indexer: string;

  @Column()
  consumer: string;

  @Column()
  currentCount: number;

  @Column()
  onchainCount: number;

  @Column()
  remoteCount: number;

  @Column()
  balance: number;

  @Column()
  expirationAt: number;

  @Column()
  challengeAt: number;

  @Column()
  deploymentId: string;

  @Column({ default: false })
  lastFinal: boolean;

  @Column({ default: 0 })
  lastPrice: number;

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
  indexer: string;

  @Field()
  consumer: string;

  @Field()
  currentCount: number;

  @Field()
  onchainCount: number;

  @Field()
  remoteCount: number;

  @Field()
  balance: number;

  @Field()
  expirationAt: number;

  @Field()
  challengeAt: number;

  @Field()
  deploymentId: string;

  @Field()
  lastFinal: boolean;

  @Field()
  lastPrice: number;

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
  count: number;

  @Field()
  isFinal: boolean;

  @Field()
  price: number;

  @Field()
  indexerSign: string;

  @Field()
  consumerSign: string;
}

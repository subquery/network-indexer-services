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
  expirationAt: number;

  @Column()
  challengeAt: number;

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
  expirationAt: number;

  @Field()
  challengeAt: number;

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

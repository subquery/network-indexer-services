// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  indexer: string; // indexer address

  @Column()
  controller: string; // encrypted private keys of controller account
}

@ObjectType('Account')
export class AccountType {
  @Field(() => ID)
  id: string;

  @Field()
  indexer: string;

  @Field()
  controller: string;
}

@ObjectType('AccountMetadata')
export class AccountMetaDataType {
  @Field(() => ID)
  indexer: string;

  @Field()
  controller: string;

  @Field()
  network: string;

  @Field()
  wsEndpoint: string;
}

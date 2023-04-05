// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
@ObjectType('Indexer')
export class Indexer {
  @PrimaryGeneratedColumn('uuid')
  @Field(() => ID)
  id: string;

  @Column()
  @Field()
  address: string; // indexer address
}

@Entity()
@ObjectType('Controller')
export class Controller {
  @PrimaryGeneratedColumn('uuid')
  @Field(() => ID)
  id: string;

  @Column()
  @Field()
  active: boolean;

  @Column()
  @Field()
  address: string; // controller address

  @Column()
  @Field()
  encryptedKey: string; // encrypted private key of controller account
}

@ObjectType('AccountMetadata')
export class AccountMetaDataType {
  @Field(() => ID)
  indexer: string;

  @Field()
  controller: string;

  @Field()
  encryptedKey: string;

  @Field()
  network: string;

  @Field()
  wsEndpoint: string;
}

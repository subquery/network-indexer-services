// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Indexer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  address: string; // indexer address
}

@Entity()
export class Controller {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  address: string; // controller address

  @Column()
  encrypted_key: string; // encrypted private key of controller account
}

// Object Types
@ObjectType('Account')
export class AccountType {
  @Field()
  indexer: string;

  @Field()
  controller: string;
}

@ObjectType('Controller')
export class ControllerType {
  @Field(() => ID)
  id: string;

  @Field()
  address: string;
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

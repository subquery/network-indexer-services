// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { SetMetadata } from '@nestjs/common';
import { Field, InputType } from '@nestjs/graphql';


@InputType()
export class MessageTypeProperty {
  @Field()
  name: string;

  @Field()
  type: string;
}

@InputType()
export class MessageTypes {
  @Field(() => [MessageTypeProperty], { nullable: true })
  EIP712Domain: MessageTypeProperty[];

  @Field(() => [MessageTypeProperty], { nullable: true })
  messageType: MessageTypeProperty[];
}

@InputType()
export class Domain {
  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  version?: string;

  @Field({ nullable: true })
  chainId?: number;

  @Field({ nullable: true })
  verifyingContract?: string;

  // @Field({ nullable: true })
  // salt?: string;
}

@InputType()
export class Message {
  @Field()
  timestamp: number;

  @Field()
  password: string;
}

@InputType()
export class SignPayload {
  @Field()
  types: MessageTypes;

  @Field()
  domain: Domain;

  @Field()
  message: Message;

  @Field()
  primaryType: 'messageType';
}

@InputType()
export class SignData {
  @Field()
  sign: string;

  @Field()
  payload: SignPayload;
}


export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
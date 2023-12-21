// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('ProjectDetailsFromNetwork')
export class ProjectDetailsFromNetwork {
  @Field()
  id: string;
  @Field({ nullable: true })
  totalReward: string;
  @Field({ nullable: true })
  indexerCount: number;
  @Field({ nullable: true })
  totalAgreement: number;
  @Field({ nullable: true })
  totalOffer: number;
}

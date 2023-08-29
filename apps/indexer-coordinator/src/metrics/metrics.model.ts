// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('VersionMetrics')
export class VersionMetrics {
  @Field(() => [Int])
  coordinator: number[];
  @Field(() => [Int])
  proxy: number[];
}

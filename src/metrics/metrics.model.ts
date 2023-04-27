// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('VersionMetrics')
export class VersionMetrics {
  @Field()
  coordinator: number[];
  @Field()
  proxy: number[];
}

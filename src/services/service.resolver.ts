// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Resolver, Query, Args } from '@nestjs/graphql';
import { ContractService } from './contract.service';

@Resolver()
export class ServiceResolver {
  constructor(private contract: ContractService) {}

  @Query(() => Boolean)
  withrawController(@Args('id') id: string) {
    return this.contract.withdrawAll(id);
  }
}

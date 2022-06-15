// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Resolver, Query } from '@nestjs/graphql';
import { ContractService } from './contract.service';

@Resolver()
export class ServiceResolver {
  constructor(private contract: ContractService) { }

  @Query(() => Boolean)
  withrawController() {
    return this.contract.withdrawAll();
  }
}

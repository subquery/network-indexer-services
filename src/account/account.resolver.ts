// Copyright 2020-2021 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Resolver, Query, Args, Mutation } from '@nestjs/graphql';
import { AccountService } from './account.service';
import { AccountMetaDataType, AccountType } from './account.model';

@Resolver(() => AccountType)
export class AccountResolver {
  constructor(private accountService: AccountService) {}

  @Query(() => [AccountType])
  accounts() {
    return this.accountService.getAccounts();
  }

  @Mutation(() => AccountType)
  addIndexer(@Args('indexer') indexer: string) {
    return this.accountService.addIndexer(indexer);
  }

  @Query(() => AccountMetaDataType)
  accountMetadata() {
    return this.accountService.getMetadata();
  }

  @Mutation(() => AccountType)
  updateController(@Args('controller') controller: string) {
    return this.accountService.addController(controller);
  }

  @Mutation(() => [AccountType])
  removeAccounts() {
    return this.accountService.removeAccounts();
  }
}

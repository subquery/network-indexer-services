// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Resolver, Query, Args, Mutation } from '@nestjs/graphql';
import { AccountService } from './account.service';
import { AccountMetaDataType, AccountType, ControllerType } from './account.model';

@Resolver(() => AccountType)
export class AccountResolver {
  constructor(private accountService: AccountService) {}

  // TODO: can remove this if not use by other projects
  @Query(() => [AccountType])
  accounts() {
    return this.accountService.getAccounts();
  }

  @Query(() => [ControllerType])
  controllers() {
    return this.accountService.getControllers();
  }

  @Mutation(() => AccountType)
  addIndexer(@Args('indexer') indexer: string) {
    return this.accountService.addIndexer(indexer);
  }

  @Query(() => AccountMetaDataType)
  accountMetadata() {
    return this.accountService.getMetadata();
  }

  @Mutation(() => String)
  addController() {
    return this.accountService.addController();
  }

  @Mutation(() => AccountType)
  removeAccount(@Args('id') id: string) {
    return this.accountService.deleteAccount(id);
  }

  @Mutation(() => String)
  removeAccounts() {
    return this.accountService.removeAccounts();
  }
}

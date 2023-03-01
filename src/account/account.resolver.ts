// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';

import { AccountEvent } from 'src/utils/subscription';
import { SubscriptionService } from 'src/subscription/subscription.service';

import { AccountService } from './account.service';
import { AccountMetaDataType, AccountType, ControllerType } from './account.model';

@Resolver(() => AccountType)
export class AccountResolver {
  constructor(private accountService: AccountService, private pubSub: SubscriptionService) {}

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

  @Subscription(() => AccountMetaDataType)
  accountChanged() {
    return this.pubSub.asyncIterator([AccountEvent.Indexer, AccountEvent.Controller]);
  }
}

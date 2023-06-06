// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';

import { SubscriptionService } from '../subscription/subscription.service';
import { AccountEvent } from '../utils/subscription';

import { AccountMetaDataType, Controller, Indexer } from './account.model';
import { AccountService } from './account.service';

@Resolver()
export class AccountResolver {
  constructor(private accountService: AccountService, private pubSub: SubscriptionService) {}

  @Mutation(() => Indexer)
  addIndexer(@Args('address') address: string) {
    return this.accountService.addIndexer(address);
  }

  @Query(() => AccountMetaDataType)
  accountMetadata() {
    return this.accountService.getAccountMetadata();
  }

  @Mutation(() => String)
  addController() {
    return this.accountService.addController();
  }

  @Mutation(() => Controller)
  removeController(@Args('id') id: string) {
    return this.accountService.removeController(id);
  }

  @Query(() => [Controller])
  controllers() {
    return this.accountService.getControllers();
  }

  @Mutation(() => AccountMetaDataType)
  removeAccounts() {
    return this.accountService.removeAccounts();
  }

  @Subscription(() => AccountMetaDataType)
  accountChanged() {
    return this.pubSub.asyncIterator([AccountEvent.Indexer, AccountEvent.Controller]);
  }
}

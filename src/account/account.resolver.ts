// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';

import { AccountEvent } from 'src/utils/subscription';
import { SubscriptionService } from 'src/subscription/subscription.service';

import { AccountService } from './account.service';
import { AccountMetaDataType, Controller, Indexer } from './account.model';

@Resolver()
export class AccountResolver {
  constructor(private accountService: AccountService, private pubSub: SubscriptionService) {}

  @Mutation(() => Indexer)
  addIndexer(@Args('indexer') indexer: string) {
    return this.accountService.addIndexer(indexer);
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

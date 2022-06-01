// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';

import { PaygService } from './payg.service';
import { ChannelType, QueryState, QueryType } from './payg.model';

@Resolver(() => ChannelType)
export class PaygResolver {
  constructor(
    private paygService: PaygService,
  ) { }

  @Query(() => ChannelType)
  channel(@Args('id') id: string) {
    return this.paygService.channel(id);
  }

  @Query(() => [ChannelType])
  channels() {
    return this.paygService.channels();
  }

  @Mutation(() => ChannelType)
  channelOpen(
    @Args('id') id: string,
    @Args('indexer') indexer: string,
    @Args('consumer') consumer: string,
    @Args('balance') balance: number,
    @Args('expiration') expiration: number,
  ) {
    return this.paygService.open(id, indexer, consumer, balance, expiration);
  }

  @Mutation(() => [QueryType])
  channelUpdate(
    @Args('id') id: string,
    @Args('count') count: number,
    @Args('isFinal') isFinal: boolean,
    @Args('price') price: number,
    @Args('indexerSign') indexerSign: string,
    @Args('consumerSign') consumerSign: string,
  ) {
    return this.paygService.update(id, count, isFinal, price, indexerSign, consumerSign);
  }

  @Mutation(() => [ChannelType])
  channelCheckpoint(@Args('id') id: string) {
    return this.paygService.checkpoint(id);
  }

  @Mutation(() => [ChannelType])
  channelChallenge(@Args('id') id: string) {
    return this.paygService.challenge(id);
  }

  @Mutation(() => [ChannelType])
  channelRespond(@Args('id') id: string) {
    return this.paygService.checkpoint(id);
  }
}

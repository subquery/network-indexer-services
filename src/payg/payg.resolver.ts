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
    @Args('total') balance: number,
    @Args('expiration') expiration: number,
    @Args('deploymentId') deploymentId: string,
    @Args('callback') callback: string,
    @Args('lastIndexerSign') lastIndexerSign: string,
    @Args('lastConsumerSign') lastConsumerSign: string,
  ) {
    return this.paygService.open(
      id,
      indexer,
      consumer,
      balance,
      expiration,
      deploymentId,
      callback,
      lastIndexerSign,
      lastConsumerSign
    );
  }

  @Mutation(() => [QueryType])
  channelUpdate(
    @Args('id') id: string,
    @Args('spent') spent: number,
    @Args('isFinal') isFinal: boolean,
    @Args('indexerSign') indexerSign: string,
    @Args('consumerSign') consumerSign: string,
  ) {
    return this.paygService.update(id, spent, isFinal, indexerSign, consumerSign);
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

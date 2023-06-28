// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';

import { SubscriptionService } from '../subscription/subscription.service';
import { PaygEvent } from '../utils/subscription';

import { ChannelType, QueryType } from './payg.model';
import { PaygService } from './payg.service';

@Resolver(() => ChannelType)
export class PaygResolver {
  constructor(private paygService: PaygService, private pubSub: SubscriptionService) {}

  @Query(() => ChannelType)
  channel(@Args('id') id: string) {
    return this.paygService.channel(id);
  }

  @Query(() => [ChannelType])
  channels() {
    return this.paygService.channels();
  }

  @Query(() => [ChannelType])
  getAliveChannels() {
    return this.paygService.getAliveChannels();
  }

  @Mutation(() => ChannelType)
  channelOpen(
    @Args('id') id: string,
    @Args('indexer') indexer: string,
    @Args('consumer') consumer: string,
    @Args('total') total: string,
    @Args('deploymentId') deploymentId: string,
    @Args('price') price: string,
  ) {
    return this.paygService.open(id, indexer, consumer, total, deploymentId, price);
  }

  @Mutation(() => QueryType)
  channelUpdate(
    @Args('id') id: string,
    @Args('spent') spent: string,
    @Args('isFinal') isFinal: boolean,
    @Args('indexerSign') indexerSign: string,
    @Args('consumerSign') consumerSign: string,
  ) {
    return this.paygService.update(id, spent, isFinal, indexerSign, consumerSign);
  }

  @Mutation(() => ChannelType)
  channelCheckpoint(@Args('id') id: string) {
    return this.paygService.checkpoint(id);
  }

  @Mutation(() => ChannelType)
  channelTerminate(@Args('id') id: string) {
    return this.paygService.terminate(id);
  }

  @Mutation(() => ChannelType)
  channelRespond(@Args('id') id: string) {
    return this.paygService.respond(id);
  }

  @Subscription(() => ChannelType)
  channelChanged() {
    return this.pubSub.asyncIterator([PaygEvent.Opened, PaygEvent.Stopped, PaygEvent.State]);
  }
}

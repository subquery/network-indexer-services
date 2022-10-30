// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';

@Injectable()
export class SubscriptionService {
  private pubSub: PubSub;
  constructor() {
    this.pubSub = new PubSub();
  }

  asyncIterator(triggers: string | string[]): AsyncIterator<unknown, any, undefined> {
    return this.pubSub.asyncIterator(triggers);
  }

  publish(triggerName: string, payload: any): Promise<void> {
    return this.pubSub.publish(triggerName, payload);
  }
}

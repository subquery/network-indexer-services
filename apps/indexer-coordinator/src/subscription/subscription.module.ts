// Copyright 2020-2025 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';

import { SubscriptionService } from './subscription.service';

@Module({
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}

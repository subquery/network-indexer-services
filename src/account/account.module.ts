// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicesModule } from '../services/services.module';

import { SubscriptionModule } from '../subscription/subscription.module';

import { Indexer, Controller } from './account.model';
import { AccountResolver } from './account.resolver';
import { AccountService } from './account.service';

@Module({
  imports: [
    forwardRef(() => ServicesModule),
    SubscriptionModule,
    TypeOrmModule.forFeature([Indexer]),
    TypeOrmModule.forFeature([Controller]),
  ],
  providers: [AccountService, AccountResolver],
  exports: [AccountService],
})
export class AccountModule {}

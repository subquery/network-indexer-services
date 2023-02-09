// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ServicesModule } from 'src/services/services.module';
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SubscriptionModule } from 'src/subscription/subscription.module';

import { AccountService } from './account.service';
import { AccountResolver } from './account.resolver';
import { Account } from './account.model';

@Module({
  imports: [forwardRef(() => ServicesModule), SubscriptionModule, TypeOrmModule.forFeature([Account])],
  providers: [AccountService, AccountResolver],
  exports: [AccountService],
})
export class AccountModule {}

// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccountModule } from '../account/account.module';
import { PaygEntity } from '../project/project.model';
import { ServicesModule } from '../services/services.module';
import { SubscriptionModule } from '../subscription/subscription.module';

import { ChainInfo, Channel, ChannelLabor } from './payg.model';
import { PaygResolver } from './payg.resolver';
import { PaygService } from './payg.service';

@Module({
  imports: [
    SubscriptionModule,
    ServicesModule,
    AccountModule,
    TypeOrmModule.forFeature([Channel]),
    TypeOrmModule.forFeature([ChannelLabor]),
    TypeOrmModule.forFeature([ChainInfo]),
    TypeOrmModule.forFeature([PaygEntity]),
  ],
  providers: [PaygService, PaygResolver],
  exports: [PaygService],
})
export class PaygModule {}

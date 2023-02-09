// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ServicesModule } from 'src/services/services.module';
import { SubscriptionModule } from 'src/subscription/subscription.module';
import { Project } from 'src/project/project.model';
import { AccountModule } from 'src/account/account.module';

import { PaygService } from './payg.service';
import { PaygResolver } from './payg.resolver';
import { ChainInfo, Channel, ChannelLabor } from './payg.model';

@Module({
  imports: [
    SubscriptionModule,
    ServicesModule,
    AccountModule,
    TypeOrmModule.forFeature([Channel]),
    TypeOrmModule.forFeature([ChannelLabor]),
    TypeOrmModule.forFeature([ChainInfo]),
    TypeOrmModule.forFeature([Project]),
  ],
  providers: [PaygService, PaygResolver],
  exports: [PaygService],
})
export class PaygModule {}

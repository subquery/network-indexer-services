// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CoreModule } from '../core/core.module';
import { PaygEntity } from '../project/project.model';
import { SubscriptionModule } from '../subscription/subscription.module';

import { ChainInfo, Channel, ChannelLabor } from './payg.model';
import { PaygQueryService } from './payg.query.service';
import { PaygResolver } from './payg.resolver';
import { PaygService } from './payg.service';
import { PaygSyncService } from './payg.sync.service';

@Module({
  imports: [
    SubscriptionModule,
    CoreModule,
    TypeOrmModule.forFeature([Channel, ChannelLabor, ChainInfo, PaygEntity]),
  ],
  providers: [PaygService, PaygSyncService, PaygQueryService, PaygResolver],
  exports: [PaygService],
})
export class PaygModule {}

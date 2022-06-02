// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ServicesModule } from 'src/services/services.module';

import { PaygService } from './payg.service';
import { PaygResolver } from './payg.resolver';
import { Channel, QueryState, ChannelStatus } from './payg.model';

@Module({
  imports: [ServicesModule, TypeOrmModule.forFeature([Channel])],
  providers: [
    PaygService,
    PaygResolver,
  ],
  exports: [PaygService],
})
export class PaygModule { }

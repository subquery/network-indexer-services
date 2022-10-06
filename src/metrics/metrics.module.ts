// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';

import { AccountModule } from 'src/account/account.module';
import { ServicesModule } from 'src/services/services.module';
import { PublicMetricsService } from './public.metric.service';

@Module({
  imports: [AccountModule, ServicesModule],
  providers: [PublicMetricsService],
  exports: [PublicMetricsService],
})
export class MetricsModule {}

// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';

import { AccountModule } from 'src/account/account.module';
import { ServicesModule } from 'src/services/services.module';
import { MetricsResolver } from './metrics.resolver';
import { VersionsService } from './versions.service';

@Module({
  imports: [AccountModule, ServicesModule],
  providers: [VersionsService, MetricsResolver],
  exports: [],
})
export class MetricsModule {}

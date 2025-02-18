// Copyright 2020-2025 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';
import { ConfigModule } from 'src/config/config.module';
import { CoreModule } from 'src/core/core.module';
import { NetworkModule } from 'src/network/network.module';
import { PaygModule } from 'src/payg/payg.module';
import { RewardService } from './reward.service';

@Module({
  imports: [CoreModule, NetworkModule, PaygModule, ConfigModule],
  providers: [RewardService],
  exports: [RewardService],
})
export class RewardModule {}

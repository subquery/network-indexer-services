// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';
import { ConfigController } from './config.controller';
import { ConfigService } from './config.service';

@Module({
  providers: [ConfigService],
  controllers: [ConfigController],
})
export class ConfigModule {}

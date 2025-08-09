// Copyright 2020-2025 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigEntity } from './config.model';
import { ConfigResolver } from './config.resolver';
import { ConfigService } from './config.service';

@Module({
  imports: [TypeOrmModule.forFeature([ConfigEntity])],
  providers: [ConfigService, ConfigResolver],
  exports: [ConfigService],
})
@Module({})
export class ConfigModule {}

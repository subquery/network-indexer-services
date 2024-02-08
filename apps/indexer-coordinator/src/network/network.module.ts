// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';
import { NetworkResolver } from './network.resolver';
import { NetworkService } from './network.service';

@Module({
  providers: [NetworkResolver, NetworkService],
  exports: [NetworkService],
})
export class NetworkModule {}

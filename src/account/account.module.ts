// Copyright 2020-2021 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountService } from './account.service';
import { AccountResolver } from './account.resolver';
import { ProjectService } from '../project/project.service';
import { Account } from './account.model';

@Module({
  imports: [TypeOrmModule.forFeature([Account]), ProjectService],
  providers: [AccountService, AccountResolver],
  exports: [AccountService],
})
export class AccountModule {}

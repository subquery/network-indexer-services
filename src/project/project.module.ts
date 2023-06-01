// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccountModule } from '../account/account.module';
import { DBModule } from '../db/db.module';
import { MetricsModule } from '../metrics/metrics.module';
import { ServicesModule } from '../services/services.module';
import { SubscriptionModule } from '../subscription/subscription.module';

import { PortService } from './port.service';
import { PaygEntity, ProjectEntity } from './project.model';
import { ProjectResolver } from './project.resolver';
import { ProjectService } from './project.service';

@Module({
  imports: [
    SubscriptionModule,
    ServicesModule,
    DBModule,
    MetricsModule,
    AccountModule,
    TypeOrmModule.forFeature([ProjectEntity, PaygEntity]),
  ],
  providers: [ProjectService, PortService, ProjectResolver],
  exports: [ProjectService],
})
export class ProjectModule {}

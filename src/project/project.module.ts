// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ServicesModule } from 'src/services/services.module';
import { SubscriptionModule } from 'src/subscription/subscription.module';
import { DBModule } from 'src/db/db.module';

import { ProjectService } from './project.service';
import { ProjectResolver } from './project.resolver';
import { PaygEntity, ProjectEntity } from './project.model';
import { MetricsModule } from 'src/metrics/metrics.module';
import { PortService } from './port.service';

@Module({
  imports: [
    SubscriptionModule,
    ServicesModule,
    DBModule,
    MetricsModule,
    TypeOrmModule.forFeature([ProjectEntity, PaygEntity]),
  ],
  providers: [ProjectService, PortService, ProjectResolver],
  exports: [ProjectService],
})
export class ProjectModule {}

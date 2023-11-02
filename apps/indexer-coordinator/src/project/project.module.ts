// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CoreModule } from '../core/core.module';
import { DBModule } from '../db/db.module';
import { MetricsModule } from '../metrics/metrics.module';
import { SubscriptionModule } from '../subscription/subscription.module';

import { PortService } from './port.service';
import { PaygEntity, ProjectEntity } from './project.model';
import { ProjectResolver } from './project.resolver';
import { ProjectRpcService } from './project.rpc.service';
import { ProjectService } from './project.service';

@Module({
  imports: [
    SubscriptionModule,
    CoreModule,
    DBModule,
    MetricsModule,
    TypeOrmModule.forFeature([ProjectEntity, PaygEntity]),
  ],
  providers: [ProjectService, PortService, ProjectResolver, ProjectRpcService],
  exports: [ProjectService, ProjectRpcService],
})
export class ProjectModule {}

// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { join, resolve } from 'path';
import * as process from 'process';
import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { GraphQLModule } from '@nestjs/graphql';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdminController } from './admin.controller';
import { AgreementController } from './agreement.controller';

import { ChainModule } from './chain/chain.module';
import { ConfigureModule } from './configure/configure.module';
import { CoreModule } from './core/core.module';
import { dbOption } from './data-source';
import { DBModule } from './db/db.module';
import { MetricsModule } from './metrics/metrics.module';
import { MonitorController } from './monitor.controller';
import { PaygModule } from './payg/payg.module';
import { ProjectModule } from './project/project.module';
import { SubscriptionModule } from './subscription/subscription.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      ...dbOption,
      autoLoadEntities: true,
      synchronize: false,
      migrationsRun: true,
    }),
    GraphQLModule.forRoot({
      autoSchemaFile: true,
      subscriptions: {
        'subscriptions-transport-ws': true,
      },
      cors: { origin: true, credentials: true },
    }),
    SubscriptionModule,
    CoreModule,
    ProjectModule,
    MetricsModule,
    PaygModule,
    ChainModule,
    ConfigureModule.register(),
    DBModule.register(),
    ServeStaticModule.forRoot({
      rootPath: process.env['INDEXER_ADMIN_ROOT']
        ? resolve(process.env['INDEXER_ADMIN_ROOT'])
        : join(__dirname, 'indexer-admin'),
      exclude: ['/env.js', '/graphql*'],
    }),
  ],
  controllers: [AdminController, AgreementController, MonitorController],
})
export class AppModule {}

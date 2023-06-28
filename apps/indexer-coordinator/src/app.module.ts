// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { join } from 'path';
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
import { DBModule } from './db/db.module';
import { MetricsModule } from './metrics/metrics.module';
import { MonitorController } from './monitor.controller';
import { PaygModule } from './payg/payg.module';
import { ProjectModule } from './project/project.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { argv, PostgresKeys } from './yargs';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: argv(PostgresKeys.host) as string,
      port: argv(PostgresKeys.port) as number,
      username: argv(PostgresKeys.username) as string,
      password: argv(PostgresKeys.password) as string,
      database: argv(PostgresKeys.database) as string,
      autoLoadEntities: true,
      synchronize: true,
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
      rootPath: join(__dirname, 'indexer-admin'),
      exclude: ['/env.js', '/graphql*'],
    }),
  ],
  controllers: [AdminController, AgreementController, MonitorController],
})
export class AppModule {}

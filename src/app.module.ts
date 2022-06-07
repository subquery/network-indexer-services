// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { join } from 'path';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigureModule } from './configure/configure.module';
import { argv, PostgresKeys } from './yargs';
import { AdminController } from './admin.controller';

import { ServicesModule } from './services/services.module'
import { AccountModule } from './account/account.module';
import { ProjectModule } from './project/project.module';
import { PaygModule } from './payg/payg.module';
import { DBModule } from './db/db.module';

@Module({
  imports: [
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
    ServicesModule,
    ProjectModule,
    AccountModule,
    PaygModule,
    ConfigureModule.register(),
    DBModule.register(),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, 'indexer-admin'),
      exclude: ['/env.js', '/graphql*'],
    }),
  ],
  controllers: [AdminController],
})
export class AppModule { }

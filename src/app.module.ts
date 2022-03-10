// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { join } from 'path';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectModule } from './project/project.module';
import { AccountModule } from './account/account.module';
import { ConfigureModule } from './configure/configure.module';
import { argv, PostgresKeys } from './yargs';
import { AdminController } from './admin.controller';

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
        'graphql-ws': true,
        'subscriptions-transport-ws': true,
      },
      cors: { origin: true, credentials: true },
    }),
    ProjectModule,
    AccountModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, 'indexer-admin'),
      exclude: ['/env.js', '/graphql*'],
    }),
    ConfigureModule.register(),
  ],
  controllers: [AdminController],
})
export class AppModule { }

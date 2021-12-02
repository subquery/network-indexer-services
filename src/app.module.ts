// Copyright 2020-2021 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectModule } from './project/project.module';
import { AccountModule } from './account/account.module';
import { ConfigureModule } from './configure/configure.module';
import { argv, PostgresKeys } from './yargs';

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
      cors: {
        origin: true,
        credentials: true,
      },
    }),
    ProjectModule,
    AccountModule,
    ConfigureModule.register(),
  ],
})
export class AppModule {}

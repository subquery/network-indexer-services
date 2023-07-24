// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import 'reflect-metadata';
import process from 'process';
import { DataSource } from 'typeorm';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { argv, PostgresKeys } from './yargs';

const isLocal = process.env.NODE_ENV === 'local';

export const dbOption: PostgresConnectionOptions = {
  type: 'postgres',
  host: process.env['DB_HOST'] ?? argv[PostgresKeys.host] ?? 'localhost',
  port: process.env['DB_PORT'] ? parseInt(process.env['DB_PORT']) : argv[PostgresKeys.port] ?? 5432,
  username: process.env['DB_USER'] ?? argv[PostgresKeys.username] ?? 'postgres',
  password: process.env['DB_PASSWORD'] ?? argv[PostgresKeys.password] ?? 'postgres',
  database: process.env['DB_NAME'] ?? argv[PostgresKeys.database] ?? 'postgres',
  synchronize: false,
  logging: isLocal,
  entities: [isLocal ? 'src/**/*.model.ts' : 'dist/**/*.model.js'],
  migrations: [isLocal ? 'src/migration/*.ts' : 'dist/migration/*.js'],
  subscribers: [],
  // namingStrategy: new SnakeNamingStrategy(),
};

export const AppDataSource = new DataSource(dbOption);

// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import 'reflect-metadata';
import path from 'path';
import process from 'process';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { getFileContent } from './utils/load';
import { getLogger } from './utils/logger';
import { argv, PostgresKeys } from './yargs';

const isLocal = process.env.NODE_ENV === 'local';

function getSSLOptions() {
  if (argv[PostgresKeys.sslMode] !== 'enabled') {
    return undefined;
  }
  const dbSSLOptions: PostgresConnectionOptions['ssl'] = { rejectUnauthorized: false };
  if (!argv[PostgresKeys.hostCertsPath] || !argv[PostgresKeys.certsPath]) {
    return dbSSLOptions;
  }
  if (argv[PostgresKeys.ca]) {
    dbSSLOptions.ca = getFileContent(
      path.join(argv[PostgresKeys.certsPath], argv[PostgresKeys.ca]),
      'postgres ca file'
    );
  }
  if (argv[PostgresKeys.key]) {
    dbSSLOptions.key = getFileContent(
      path.join(argv[PostgresKeys.certsPath], argv[PostgresKeys.key]),
      'postgres key file'
    );
  }
  if (argv[PostgresKeys.cert]) {
    dbSSLOptions.cert = getFileContent(
      path.join(argv[PostgresKeys.certsPath], argv[PostgresKeys.cert]),
      'postgres cert file'
    );
  }
  return dbSSLOptions;
}

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
  ssl: getSSLOptions(),
};

if (argv['log-args']) {
  getLogger('data-source').debug('DB Options: %o', dbOption);
}

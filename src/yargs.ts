// Copyright 2020-2021 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';

export enum PostgresKeys {
  host = 'postgres-host',
  port = 'postgres-port',
  username = 'postgres-username',
  password = 'postgres-password',
  database = 'postgres-database',
}

export function getYargsOption() {
  return yargs(hideBin(process.argv)).options({
    network: {
      demandOption: false,
      describe: 'Network type for the service',
      type: 'string',
      choices: ['local', 'testnet', 'mainnet'],
      default: 'local',
      group: 'Indexer Coordinator',
    },
    'ws-endpoint': {
      type: 'string',
      describe: 'Specify wss endpoint for this network',
      demandOption: true,
      group: 'Indexer Coordinator',
    },
    host: {
      type: 'string',
      describe: 'Host the service will deploy on',
      default: 'localhost',
      group: 'Indexer Coordinator',
    },
    port: {
      type: 'number',
      describe: 'Port the service will listen on',
      default: 8000,
      group: 'Indexer Coordinator',
    },
    [PostgresKeys.host]: {
      type: 'string',
      describe: 'Postgres host',
      demandOption: true,
      group: 'Postgres',
    },
    [PostgresKeys.port]: {
      type: 'number',
      describe: 'Postgres port',
      default: 5432,
      group: 'Postgres',
    },
    [PostgresKeys.username]: {
      type: 'string',
      describe: 'Postgres username',
      default: 'postgres',
      group: 'Postgres',
    },
    [PostgresKeys.password]: {
      type: 'string',
      describe: 'Postgres password',
      default: 'postgres',
      group: 'Postgres',
    },
    [PostgresKeys.database]: {
      type: 'string',
      describe: 'Postgres database name',
      demandOption: true,
      group: 'Postgres',
    },
  });
}

export function argv(arg: string): unknown {
  return getYargsOption().argv[arg];
}

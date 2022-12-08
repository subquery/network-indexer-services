// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';

export enum Groups {
  coordinator = 'Indexer Coordinator',
  postgres = 'Postgres',
  metrics = 'Metrics',
}

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
      choices: ['moonbase', 'testnet', 'mainnet'],
      default: 'moonbase',
      group: Groups.coordinator,
    },
    'ws-endpoint': {
      type: 'string',
      describe: 'Specify wss endpoint for this network',
      demandOption: true,
      default: 'https://rpc.api.moonbase.moonbeam.network',
      group: Groups.coordinator,
    },
    'start-block': {
      type: 'number',
      describe: 'Specify the block hight start sync',
      demandOption: true,
      default: 3301462,
      group: Groups.coordinator,
    },
    ipfs: {
      type: 'string',
      describe: 'Specify ipfs endpoint for this network',
      default: 'https://unauthipfs.subquery.network/ipfs/api/v0',
      group: Groups.coordinator,
    },
    port: {
      type: 'number',
      describe: 'Port the service will listen on',
      default: 8000,
      group: Groups.coordinator,
    },
    debug: {
      type: 'boolean',
      describe: 'Enable debug mode',
      default: false,
      group: Groups.coordinator,
    },
    dev: {
      type: 'boolean',
      describe: 'Enable dev mode',
      default: false,
      group: Groups.coordinator,
    },
    [PostgresKeys.host]: {
      type: 'string',
      describe: 'Postgres host',
      demandOption: true,
      default: 'coordinator_db_dev',
      group: Groups.postgres,
    },
    [PostgresKeys.port]: {
      type: 'number',
      describe: 'Postgres port',
      default: 5432,
      group: Groups.postgres,
    },
    [PostgresKeys.username]: {
      type: 'string',
      describe: 'Postgres username',
      default: 'postgres',
      group: Groups.postgres,
    },
    [PostgresKeys.password]: {
      type: 'string',
      describe: 'Postgres password',
      default: 'postgres',
      group: Groups.postgres,
    },
    [PostgresKeys.database]: {
      type: 'string',
      describe: 'Postgres database name',
      demandOption: true,
      default: 'postgres',
      group: Groups.postgres,
    },
  });
}

export function argv(arg: string): unknown {
  return getYargsOption().argv[arg];
}

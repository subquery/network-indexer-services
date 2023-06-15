// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

export enum Groups {
  coordinator = 'Indexer Coordinator',
  node = 'Indexer Node',
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
      choices: ['testnet', 'kepler', 'mainnet'],
      default: 'kepler',
      group: Groups.coordinator,
    },
    'ws-endpoint': {
      type: 'string',
      describe: 'Specify wss endpoint for this network',
      demandOption: true,
      default: 'https://polygon-rpc.com',
      group: Groups.coordinator,
    },
    'start-block': {
      type: 'number',
      describe: 'Specify the block hight start sync',
      demandOption: true,
      default: 33168664,
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
    'use-prerelease': {
      type: 'boolean',
      describe: 'Enable pre-release versions for the docker images',
      default: false,
      group: Groups.node,
    },
    'start-port': {
      type: 'number',
      describe: 'The start port number for the indexer node',
      default: 3001,
      group: Groups.node,
    },
    mmrPath: {
      type: 'string',
      describe: 'The local path to store the mmr data',
      default: '/home/indexer-service',
      group: Groups.node,
    },
    'docker-network': {
      type: 'string',
      describe: 'The default docker network',
      default: 'indexer_services',
      group: Groups.node,
    },
    'secret-key': {
      type: 'string',
      describe: 'Specify secret key for the service',
      default: 'ThisIsYourSecret',
      group: Groups.coordinator,
    },
    [PostgresKeys.host]: {
      type: 'string',
      describe: 'Postgres host',
      demandOption: true,
      default: 'indexer_db',
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
      default: 'pos_z8X',
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

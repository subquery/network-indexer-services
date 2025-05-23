// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
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
  sslMode = 'postgres-ssl-mode',
  hostCertsPath = 'postgres-host-certs-path',
  certsPath = 'postgres-certs-path',
  ca = 'postgres-ca',
  key = 'postgres-key',
  cert = 'postgres-cert',
}

function getYargsOption() {
  return yargs(hideBin(process.argv)).options({
    network: {
      demandOption: false,
      describe: 'Network type for the service',
      type: 'string',
      choices: ['testnet', 'kepler', 'mainnet'],
      default: 'mainnet',
      group: Groups.coordinator,
    },
    'network-endpoint': {
      type: 'string',
      describe: 'Specify rpc endpoint for this network',
      demandOption: true,
      default: 'https://mainnet.base.org',
      group: Groups.coordinator,
    },
    'eth-endpoint': {
      type: 'string',
      describe: 'Specify eth rpc endpoint',
      default: 'https://eth.llamarpc.com',
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
      default: '/home',
      group: Groups.node,
    },
    'compose-file-directory': {
      type: 'string',
      describe: 'The local path to store the generated compose file',
      default: '/usr',
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
    [PostgresKeys.sslMode]: {
      type: 'string',
      describe: 'Postgres ssl mode',
      choices: ['enabled', 'disabled'],
      default: 'disabled',
      group: Groups.postgres,
    },
    [PostgresKeys.hostCertsPath]: {
      type: 'string',
      describe: 'Postgres certificates folder path in the host system',
      default: '',
      group: Groups.postgres,
    },
    [PostgresKeys.certsPath]: {
      type: 'string',
      describe: 'Postgres certificates folder path',
      default: '',
      group: Groups.postgres,
    },
    [PostgresKeys.ca]: {
      type: 'string',
      describe: 'Postgres ca file name',
      default: '',
      group: Groups.postgres,
    },
    [PostgresKeys.key]: {
      type: 'string',
      describe: 'Postgres key file name',
      default: '',
      group: Groups.postgres,
    },
    [PostgresKeys.cert]: {
      type: 'string',
      describe: 'Postgres cert file name',
      default: '',
      group: Groups.postgres,
    },
    'redis-url': {
      type: 'string',
      describe: 'Redis connection url',
      default: 'redis://indexer_cache:6379',
      group: Groups.coordinator,
    },
    'gas-fee-limit': {
      type: 'string',
      describe: 'Gas fee limit for the transaction',
      default: '0',
      group: Groups.coordinator,
    },
    'log-args': {
      type: 'boolean',
      describe: 'Log the arguments passed to the service',
      default: false,
      group: Groups.coordinator,
    },
    'host-env': {
      type: 'string',
      describe: 'k8s or docker',
      default: 'docker',
      group: Groups.coordinator,
    },
    'reward-cron': {
      demandOption: false,
      describe: 'Reward task cron',
      type: 'string',
      default: '1 1 1 * * *',
      group: Groups.coordinator,
    },
    'reward-check-cron': {
      demandOption: false,
      describe: 'Reward task check cron',
      type: 'string',
      default: '0 */30 * * * *',
      group: Groups.coordinator,
    },
    'sentry-dsn': {
      demandOption: false,
      describe: 'sentry dsn',
      type: 'string',
      default:
        'https://94b886c37a3436e3bc1c29fbfd34f6de@o1192865.ingest.us.sentry.io/4508771319414784',
      group: Groups.coordinator,
    },
    'chs-endpoint': {
      demandOption: false,
      describe: 'chs endpoint url',
      type: 'string',
      default: 'https://chs.subquery.network',
      group: Groups.coordinator,
    },
  });
}

export const argv = getYargsOption().argv;

// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { DynamicModule, Global, Module } from '@nestjs/common';
import { Client } from 'pg';
import { getLogger } from '../utils/logger';
import { getYargsOption, PostgresKeys } from '../yargs';

export class DB {
  private dbClient: Client;

  constructor() {
    const { argv } = getYargsOption();
    this.dbClient = new Client({
      host: argv[PostgresKeys.host],
      port: argv[PostgresKeys.port],
      user: argv[PostgresKeys.username],
      password: argv[PostgresKeys.password],
      database: argv[PostgresKeys.database],
    });
  }

  async connect(): Promise<void> {
    await this.dbClient.connect();
    await this.createDBExtension();
  }

  async checkSchemaExist(name: string): Promise<boolean> {
    const query = `SELECT schema_name FROM information_schema.schemata WHERE schema_name = '${name}'`;
    try {
      const r = await this.dbClient.query(query);
      return r.rowCount > 0;
    } catch {
      return false;
    }
  }

  async createDBExtension() {
    await this.dbClient.query('CREATE EXTENSION IF NOT EXISTS btree_gist');
    getLogger('db').info('Add btree_gist extension to db');
  }

  async createDBSchema(name: string) {
    await this.dbClient.query(`CREATE SCHEMA IF NOT EXISTS ${name}`);
    getLogger('docker').info(`create new db schema: ${name}`);
  }

  async dropDBSchema(name: string) {
    const query = `DROP SCHEMA IF EXISTS ${name} CASCADE`;
    await this.dbClient.query(query);
    getLogger('docker').info(`drop db schema: ${name}`);
  }

  async clearMMRoot(name: string, blockHeight: number) {
    getLogger('docker').info('start purging mmrRoot...');
    await this.dbClient.query(`UPDATE ${name}._poi SET "mmrRoot" = NULL WHERE id >= ${blockHeight}`);
    getLogger('docker').info('clear mmrRoot completed');
  }
}

@Global()
@Module({})
export class DBModule {
  static register(): DynamicModule {
    return {
      module: DBModule,
      providers: [
        {
          provide: DB,
          useFactory: async ()=> {
            const db = new DB();
            await db.connect();
            return db;
          },
        },
      ],
      exports: [DB],
    };
  }
}

// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { DynamicModule, Global, Module } from '@nestjs/common';
import { Client } from 'pg';
import { getLogger } from 'src/utils/logger';
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

  public async connect(): Promise<void> {
    return this.dbClient.connect();
  }

  public async checkSchemaExist(name: string): Promise<boolean> {
    const query = `SELECT exists(select schema_name FROM information_schema.schemata WHERE schema_name = '${name}'`;
    try {
      const r = await this.dbClient.query(query);
      return r.rowCount > 0;
    } catch {
      return false;
    }
  }

  public async createDBSchema(name: string) {
    const dbExist = await this.checkSchemaExist(name);
    if (dbExist) {
      getLogger('db').info(`db schema: ${name} already exist`);
      return;
    }

    getLogger('docker').info(`create new db schema: ${name}`);
    await this.dbClient.query(`CREATE SCHEMA IF NOT EXISTS ${name}`);
    await this.dbClient.query(`CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA ${name}`);
  }

  public async dropDBSchema(name: string) {
    const dbExist = await this.checkSchemaExist(name);
    if (!dbExist) {
      getLogger('docker').info(`db schema: ${name} is not exist`);
      return;
    }

    getLogger('docker').info(`drop db schema: ${name}`);
    const query = `DROP SCHEMA IF EXISTS ${name}`;
    await this.dbClient.query(query);
  }
}

@Global()
@Module({})
export class DBModule {
  static register(): DynamicModule {
    const db = new DB();
    db.connect();

    return {
      module: DBModule,
      providers: [
        {
          provide: DB,
          useValue: db,
        },
      ],
      exports: [DB],
    };
  }
}

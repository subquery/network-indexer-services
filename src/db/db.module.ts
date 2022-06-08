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

  public async checkDBExist(name: string): Promise<boolean> {
    const query = `SELECT * FROM pg_database WHERE lower(datname) = lower('${name}');`;
    try {
      const r = await this.dbClient.query(query);
      console.log('check db exit:', r.rowCount, r.rows);
      return r.rowCount > 0;
    } catch {
      return false;
    }
  }

  public async createDB(name: string) {
    const dbExist = await this.checkDBExist(name);
    if (dbExist) {
      getLogger('db').info(`db: ${name} already exist`);
      return;
    }

    getLogger('docker').info(`create new db: ${name}`);
    const query = `CREATE DATABASE ${name}`;
    const r = await this.dbClient.query(query);
    console.log('create db result:', r);
  }

  public async dropDB(name: string) {
    const dbExist = await this.checkDBExist(name);
    if (!dbExist) {
      getLogger('docker').info(`db: ${name} is not exist`);
      return;
    }

    getLogger('docker').info(`drop db: ${name}`);
    const query = `DROP DATABASE ${name}`;
    const r = await this.dbClient.query(query);
    // console.log('drop db result:', r);
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

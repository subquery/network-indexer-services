// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { DynamicModule, Global, Module, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection, TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { getLogger } from '../utils/logger';

export class DB implements OnApplicationBootstrap {
  constructor(
    @InjectConnection()
    private dataSource: DataSource,
  ) {}

  onApplicationBootstrap(): void {
    void this.createDBExtension();
  }

  async checkSchemaExist(name: string): Promise<boolean> {
    const query = `SELECT schema_name
                   FROM information_schema.schemata
                   WHERE schema_name = '${name}'`;
    try {
      const r = await this.dataSource.query(query);
      return r.rowCount > 0;
    } catch {
      return false;
    }
  }

  async checkTableExist(name: string, schema: string): Promise<boolean> {
    const query = `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = '${schema}' AND table_name = '${name}')`;
    try {
      const r = await this.dataSource.query(query);
      // TODO: check table exist (t/f)
      return r.rowCount > 0;
    } catch {
      return false;
    }
  }

  async createDBExtension() {
    await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS btree_gist');
    getLogger('db').info('Add btree_gist extension to db');
  }

  async createDBSchema(name: string) {
    await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS ${name}`);
    getLogger('docker').info(`create new db schema: ${name}`);
  }

  async dropDBSchema(name: string) {
    const query = `DROP SCHEMA IF EXISTS ${name} CASCADE`;
    await this.dataSource.query(query);
    getLogger('docker').info(`drop db schema: ${name}`);
  }

  async clearMMRoot(name: string, blockHeight: number) {
    getLogger('docker').info('start purging mmrRoot...');
    await this.dataSource.query(`UPDATE ${name}._poi
                               SET "mmrRoot" = NULL
                               WHERE id >= ${blockHeight}`);
    getLogger('docker').info('clear mmrRoot completed');
  }
}

@Global()
@Module({})
export class DBModule {
  static register(): DynamicModule {
    return {
      module: DBModule,
      imports: [TypeOrmModule.forFeature()],
      providers: [DB],
      exports: [DB],
    };
  }
}

// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { dbOption } from 'src/data-source';
import { MigrationInterface, QueryRunner } from 'typeorm';

const schema = dbOption.schema;

export class Init1687000788908 implements MigrationInterface {
  name = 'Init1687000788908';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "${schema}"."chain" ("name" character varying NOT NULL, "value" character varying NOT NULL, CONSTRAINT "PK_d04674dd31adb83181ee0652f44" PRIMARY KEY ("name"))`
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "${schema}"."indexer" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "address" character varying NOT NULL, CONSTRAINT "PK_c4c8947d39912d44325b5233e84" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "${schema}"."controller" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "active" boolean NOT NULL, "address" character varying NOT NULL, "encryptedKey" character varying NOT NULL, CONSTRAINT "PK_19af8f7038661f7c18f08316bf0" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "${schema}"."project_entity" ("id" character varying NOT NULL, "status" integer NOT NULL, "chainType" character varying NOT NULL DEFAULT '', "nodeEndpoint" character varying NOT NULL DEFAULT '', "queryEndpoint" character varying NOT NULL DEFAULT '', "details" jsonb NOT NULL DEFAULT '{}', "baseConfig" jsonb NOT NULL DEFAULT '{"networkEndpoint":"","networkDictionary":"","nodeVersion":"","queryVersion":""}', "advancedConfig" jsonb NOT NULL DEFAULT '{"purgeDB":false,"poiEnabled":true,"timeout":1800,"worker":2,"batchSize":50,"cache":300,"cpu":2,"memory":2046}', CONSTRAINT "PK_7a75a94e01d0b50bff123db1b87" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "${schema}"."payg_entity" ("id" character varying NOT NULL, "price" character varying NOT NULL DEFAULT '', "expiration" integer NOT NULL DEFAULT '0', "threshold" integer NOT NULL DEFAULT '100', "overflow" integer NOT NULL DEFAULT '5', CONSTRAINT "PK_97bf32b06b9fb1db819fbbaec69" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "${schema}"."channel" ("id" character varying NOT NULL, "status" integer NOT NULL, "deploymentId" character varying NOT NULL, "indexer" character varying NOT NULL, "consumer" character varying NOT NULL, "total" character varying NOT NULL DEFAULT '', "spent" character varying NOT NULL DEFAULT '', "onchain" character varying NOT NULL DEFAULT '', "remote" character varying NOT NULL DEFAULT '', "price" character varying NOT NULL DEFAULT '', "expiredAt" integer NOT NULL, "terminatedAt" integer NOT NULL, "terminateByIndexer" boolean NOT NULL, "lastFinal" boolean NOT NULL DEFAULT false, "lastIndexerSign" character varying NOT NULL DEFAULT '', "lastConsumerSign" character varying NOT NULL DEFAULT '', CONSTRAINT "PK_590f33ee6ee7d76437acf362e39" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "${schema}"."channel_labor" ("id" SERIAL NOT NULL, "deploymentId" character varying NOT NULL, "indexer" character varying NOT NULL, "total" character varying NOT NULL, "createdAt" integer NOT NULL, CONSTRAINT "PK_b0cc18f523e20623a8b1d6f1c46" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "${schema}"."chain_info" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "value" character varying NOT NULL, CONSTRAINT "PK_1b82ce2acbc16bfc7f84bfdc8ff" PRIMARY KEY ("id"))`
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "${schema}"."chain_info"`);
    await queryRunner.query(`DROP TABLE "${schema}"."channel_labor"`);
    await queryRunner.query(`DROP TABLE "${schema}"."channel"`);
    await queryRunner.query(`DROP TABLE "${schema}"."payg_entity"`);
    await queryRunner.query(`DROP TABLE "${schema}"."project_entity"`);
    await queryRunner.query(`DROP TABLE "${schema}"."controller"`);
    await queryRunner.query(`DROP TABLE "${schema}"."indexer"`);
    await queryRunner.query(`DROP TABLE "${schema}"."chain"`);
  }
}

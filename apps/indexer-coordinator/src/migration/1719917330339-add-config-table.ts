// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConfigTable1719917330339 implements MigrationInterface {
  name = 'AddConfigTable1719917330339';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "config" ("created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "id" SERIAL NOT NULL, "key" character varying NOT NULL, "value" character varying DEFAULT '', "group" character varying DEFAULT 'default', "sort" integer DEFAULT '0', CONSTRAINT "PK_d0ee79a681413d50b0a4f98cf7b" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_26489c99ddbb4c91631ef5cc79" ON "config" ("key") `
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_26489c99ddbb4c91631ef5cc79"`);
    await queryRunner.query(`DROP TABLE "config"`);
  }
}

// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIntegrationTable1721982447267 implements MigrationInterface {
  name = 'AddIntegrationTable1721982447267';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "integration_entity" ("id" SERIAL NOT NULL, "title" character varying NOT NULL, "type" integer NOT NULL, "serviceEndpoints" jsonb NOT NULL DEFAULT '{}', "enabled" boolean NOT NULL DEFAULT false, "config" jsonb NOT NULL DEFAULT '{}', "extra" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "PK_f42c182dafb16de2e24566c43e6" PRIMARY KEY ("id"))`
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "integration_entity"`);
  }
}

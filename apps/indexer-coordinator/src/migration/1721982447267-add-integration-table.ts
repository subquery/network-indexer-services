// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIntegrationTable1721982447267 implements MigrationInterface {
  name = 'AddIntegrationTable1721982447267';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "integration" ("id" SERIAL NOT NULL, "title" character varying(50) NOT NULL, "type" integer NOT NULL, "serviceEndpoints" jsonb NOT NULL DEFAULT '{}', "enabled" boolean NOT NULL DEFAULT false, "config" jsonb NOT NULL DEFAULT '{}', "extra" jsonb NOT NULL DEFAULT '{}', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f348d4694945d9dc4c7049a178a" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_814dc61a29c5383dc90993603f" ON "integration" ("title") `
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_814dc61a29c5383dc90993603f"`);
    await queryRunner.query(`DROP TABLE "integration"`);
  }
}

// Copyright 2020-2025 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHostType1721118564278 implements MigrationInterface {
  name = 'AddHostType1721118564278';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project_entity" ADD "hostType" character varying NOT NULL DEFAULT 'system-managed'`
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "project_entity" DROP COLUMN "hostType"`);
  }
}

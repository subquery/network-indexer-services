// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectKind1721118564278 implements MigrationInterface {
  name = 'AddProjectKind1721118564278';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project_entity" ADD "projectKind" character varying NOT NULL DEFAULT 'system-managed'`
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "project_entity" DROP COLUMN "projectKind"`);
  }
}

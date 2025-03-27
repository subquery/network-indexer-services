// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUseDefaultField1743043042093 implements MigrationInterface {
  name = 'AddUseDefaultField1743043042093';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payg_entity" ADD "useDefault" boolean NOT NULL DEFAULT true`
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payg_entity" DROP COLUMN "useDefault"`);
  }
}

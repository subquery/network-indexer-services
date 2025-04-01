// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUseDefaultField1743043042093 implements MigrationInterface {
  name = 'AddUseDefaultField1743043042093';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payg_entity" ADD "useDefault" boolean NOT NULL DEFAULT true`
    );
    await queryRunner.query(
      `
      INSERT INTO "config"("created_at", "updated_at", "key", "value", "sort") 
      VALUES (DEFAULT, DEFAULT, 'flex_price', '500000000000000', DEFAULT),
			 (DEFAULT, DEFAULT, 'flex_price_ratio', '80', DEFAULT),
			 (DEFAULT, DEFAULT, 'flex_valid_period', '259200', DEFAULT)
      ON CONFLICT ( "key" ) 
      DO UPDATE SET 
        "value" = EXCLUDED."value",
        "updated_at" = NOW()
      `
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payg_entity" DROP COLUMN "useDefault"`);
  }
}

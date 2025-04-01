// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPriceRatioField1742528842664 implements MigrationInterface {
  name = 'AddPriceRatioField1742528842664';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payg_entity" ADD "priceRatio" integer`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payg_entity" DROP COLUMN "priceRatio"`);
  }
}

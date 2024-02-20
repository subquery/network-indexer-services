// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { dbOption } from 'src/data-source';
import { MigrationInterface, QueryRunner } from 'typeorm';

const schema = dbOption.schema;

export class AddProjectRateLimit1701361246451 implements MigrationInterface {
  name = 'AddProjectRateLimit1701361246451';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "${schema}"."project_entity" ADD "rateLimit" integer NOT NULL DEFAULT '0'`
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "${schema}"."project_entity" DROP COLUMN "rateLimit"`);
  }
}

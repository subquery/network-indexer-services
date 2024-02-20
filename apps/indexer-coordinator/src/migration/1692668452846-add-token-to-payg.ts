// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { dbOption } from 'src/data-source';
import { MigrationInterface, QueryRunner } from 'typeorm';

const schema = dbOption.schema;

export class AddTokenToPayg1692668452846 implements MigrationInterface {
  name = 'AddTokenToPayg1692668452846';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "${schema}"."payg_entity" ADD "token" character varying NOT NULL DEFAULT ''`
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "${schema}"."payg_entity" DROP COLUMN "token"`);
  }
}

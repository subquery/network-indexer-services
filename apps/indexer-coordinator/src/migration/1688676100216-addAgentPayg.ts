// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { dbOption } from 'src/data-source';
import { MigrationInterface, QueryRunner } from 'typeorm';

const schema = dbOption.schema;

export class AddAgentPayg1688676100216 implements MigrationInterface {
  name = 'AddAgentPayg1688676100216';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "${schema}"."channel" ADD "agent" character varying NOT NULL DEFAULT ''`
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "${schema}"."channel" DROP COLUMN "agent"`);
  }
}

// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAgentPayg1688676100216 implements MigrationInterface {
  name = 'AddAgentPayg1688676100216';

  async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('channel');
    const isAgentColumnExist = table.columns.find((column) => column.name === 'agent');

    if (!isAgentColumnExist) {
      await queryRunner.query(`ALTER TABLE "channel" ADD "agent" character varying NOT NULL DEFAULT ''`);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('channel');
    const isAgentColumnExist = table.columns.find((column) => column.name === 'agent');

    if (isAgentColumnExist) {
      await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN "agent"`);
    }
  }
}

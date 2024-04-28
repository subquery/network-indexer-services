// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateStatsDataTime1701943045349 implements MigrationInterface {
  name = 'UpdateStatsDataTime1701943045349';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project_statistics_entity" ALTER COLUMN "dataTime" TYPE TIMESTAMP WITH TIME ZONE USING "dataTime" AT TIME ZONE 'UTC'`
    );
    await queryRunner.query(
      `ALTER TABLE "project_statistics_entity" ALTER COLUMN "createdAt" TYPE TIMESTAMP WITH TIME ZONE USING "createdAt" AT TIME ZONE 'UTC'`
    );
    await queryRunner.query(
      `ALTER TABLE "project_statistics_entity" ALTER COLUMN "updatedAt" TYPE TIMESTAMP WITH TIME ZONE USING "updatedAt" AT TIME ZONE 'UTC'`
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project_statistics_entity" ALTER COLUMN "dataTime" TYPE TIMESTAMP USING "dataTime" AT TIME ZONE 'UTC'`
    );
    await queryRunner.query(
      `ALTER TABLE "project_statistics_entity" ALTER COLUMN "createdAt" TYPE TIMESTAMP USING "createdAt" AT TIME ZONE 'UTC'`
    );
    await queryRunner.query(
      `ALTER TABLE "project_statistics_entity" ALTER COLUMN "updatedAt" TYPE TIMESTAMP USING "updatedAt" AT TIME ZONE 'UTC'`
    );
  }
}

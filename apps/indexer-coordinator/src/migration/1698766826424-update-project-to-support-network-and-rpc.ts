// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateProjectToSupportNetworkAndRpc1698766826424 implements MigrationInterface {
  name = 'UpdateProjectToSupportNetworkAndRpc1698766826424';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project_entity" ADD "projectType" character varying NOT NULL DEFAULT ''`
    );
    await queryRunner.query(
      `ALTER TABLE "project_entity" ADD "serviceEndpoints" jsonb NOT NULL DEFAULT '{}'`
    );
    await queryRunner.query(
      `ALTER TABLE "project_entity" ADD "manifest" jsonb NOT NULL DEFAULT '{}'`
    );
    await queryRunner.query(
      `ALTER TABLE "project_entity" ADD "projectConfig" jsonb NOT NULL DEFAULT '{}'`
    );
    await queryRunner.query(
      `ALTER TABLE "project_entity" ALTER COLUMN "baseConfig" SET DEFAULT '{"networkEndpoints":[],"networkDictionary":"","nodeVersion":"","queryVersion":"","usePrimaryNetworkEndpoint":true}'`
    );

    const projects = await queryRunner.query(
      `SELECT id, "projectType", "nodeEndpoint", "queryEndpoint", "serviceEndpoints", "baseConfig", "advancedConfig", "projectConfig" FROM project_entity`
    );

    for (const project of projects) {
      const { id, nodeEndpoint, queryEndpoint, baseConfig, advancedConfig } = project;

      let { projectType, serviceEndpoints, projectConfig } = project;

      if (projectType !== 'Subquery' && projectType !== '') continue;

      projectType = 'Subquery';

      serviceEndpoints = {
        nodeEndpoint,
        queryEndpoint,
      };

      projectConfig = {
        ...baseConfig,
        ...advancedConfig,
      };

      await queryRunner.query(
        `UPDATE project_entity SET "projectType" = $1, "serviceEndpoints" = $2, "projectConfig" = $3 WHERE id = $4`,
        [projectType, serviceEndpoints, projectConfig, id]
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project_entity" ALTER COLUMN "baseConfig" SET DEFAULT '{"nodeVersion": "", "queryVersion": "", "networkEndpoint": "", "networkDictionary": ""}'`
    );
    await queryRunner.query(`ALTER TABLE "project_entity" DROP COLUMN "projectConfig"`);
    await queryRunner.query(`ALTER TABLE "project_entity" DROP COLUMN "manifest"`);
    await queryRunner.query(`ALTER TABLE "project_entity" DROP COLUMN "serviceEndpoints"`);
    await queryRunner.query(`ALTER TABLE "project_entity" DROP COLUMN "projectType"`);
  }
}

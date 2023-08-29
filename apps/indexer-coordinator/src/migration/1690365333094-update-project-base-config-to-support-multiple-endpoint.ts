// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { MigrationInterface, QueryRunner } from 'typeorm';

interface IProjectBaseConfig {
  networkEndpoint?: string;
  networkEndpoints?: string[];
  networkDictionary?: string;
  nodeVersion?: string;
  queryVersion?: string;
}
export class UpdateProjectBaseConfigToSupportMultipleEndpoint1690365333094
  implements MigrationInterface
{
  name = 'UpdateProjectBaseConfigToSupportMultipleEndpoint1690365333094';

  async up(queryRunner: QueryRunner): Promise<void> {
    const projects = await queryRunner.query(`SELECT id, "baseConfig" FROM project_entity`);
    for (const project of projects) {
      const baseConfig: IProjectBaseConfig = project.baseConfig;
      if (!baseConfig.networkEndpoints) {
        baseConfig.networkEndpoints = baseConfig.networkEndpoint
          ? [baseConfig.networkEndpoint]
          : [];
        delete baseConfig.networkEndpoint;
      }
      await queryRunner.query(`UPDATE project_entity SET "baseConfig" = $1 WHERE id = $2`, [
        baseConfig,
        project.id,
      ]);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const projects = await queryRunner.query(`SELECT id, "baseConfig" FROM project_entity`);
    for (const project of projects) {
      const baseConfig: IProjectBaseConfig = project.baseConfig;
      if (!baseConfig.networkEndpoint) {
        baseConfig.networkEndpoint = baseConfig.networkEndpoints[0] ?? '';
        delete baseConfig.networkEndpoints;
      }
      await queryRunner.query(`UPDATE project_entity SET "baseConfig" = $1 WHERE id = $2`, [
        baseConfig,
        project.id,
      ]);
    }
  }
}

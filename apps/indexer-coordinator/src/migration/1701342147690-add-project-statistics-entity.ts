// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectStatisticsEntity1701342147690 implements MigrationInterface {
  name = 'AddProjectStatisticsEntity1701342147690';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "project_statistics_entity" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "dataTime" TIMESTAMP NOT NULL, "deploymentCid" character varying NOT NULL, "serviceEndpointType" character varying, "time" integer NOT NULL DEFAULT '0', "failure" integer NOT NULL DEFAULT '0', "freeHttp" integer NOT NULL DEFAULT '0', "freeP2p" integer NOT NULL DEFAULT '0', "caHttp" integer NOT NULL DEFAULT '0', "caP2p" integer NOT NULL DEFAULT '0', "paygHttp" integer NOT NULL DEFAULT '0', "paygP2p" integer NOT NULL DEFAULT '0', CONSTRAINT "UQ_a02e31129efc3b2cc201e201bcd" UNIQUE ("dataTime", "deploymentCid"), CONSTRAINT "PK_db31d98a5d1c5c95ffc5c221a27" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `ALTER TABLE "project_entity" ALTER COLUMN "baseConfig" SET DEFAULT '{}'`
    );
    await queryRunner.query(
      `ALTER TABLE "project_entity" ALTER COLUMN "advancedConfig" SET DEFAULT '{}'`
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project_entity" ALTER COLUMN "advancedConfig" SET DEFAULT '{"cpu": 2, "cache": 300, "memory": 2046, "worker": 2, "purgeDB": false, "timeout": 1800, "batchSize": 50, "poiEnabled": true}'`
    );
    await queryRunner.query(
      `ALTER TABLE "project_entity" ALTER COLUMN "baseConfig" SET DEFAULT '{"nodeVersion": "", "queryVersion": "", "networkEndpoints": [], "networkDictionary": "", "usePrimaryNetworkEndpoint": true}'`
    );
    await queryRunner.query(`DROP TABLE "project_statistics_entity"`);
  }
}

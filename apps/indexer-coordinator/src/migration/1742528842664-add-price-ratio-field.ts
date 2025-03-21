import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPriceRatioField1742528842664 implements MigrationInterface {
  name = 'AddPriceRatioField1742528842664';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payg_entity" ADD "priceRatio" integer`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payg_entity" DROP COLUMN "priceRatio"`);
  }
}

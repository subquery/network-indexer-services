import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenamePriceToMinprice1742524556395 implements MigrationInterface {
  name = 'RenamePriceToMinprice1742524556395';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payg_entity" RENAME COLUMN "price" TO "minPrice"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payg_entity" RENAME COLUMN "minPrice" TO "price"`);
  }
}

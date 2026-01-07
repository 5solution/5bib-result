import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1767778305199 implements MigrationInterface {
  name = 'Migrations1767778305199';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "races" ALTER COLUMN "max_code_per_user" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "races" ALTER COLUMN "bib_strategy" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "races" ALTER COLUMN "race_kit_strategy" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "races" ALTER COLUMN "race_kit_strategy" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "races" ALTER COLUMN "bib_strategy" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "races" ALTER COLUMN "max_code_per_user" SET NOT NULL`,
    );
  }
}

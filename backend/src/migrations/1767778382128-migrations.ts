import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1767778382128 implements MigrationInterface {
  name = 'Migrations1767778382128';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "races" ALTER COLUMN "send_skip_liability_email" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "races" ALTER COLUMN "allow_transfer_zero_price_code" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "races" ALTER COLUMN "vat_public" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "races" ALTER COLUMN "public_athlete_basic_info" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "races" ALTER COLUMN "required_transfer_fee" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "races" ALTER COLUMN "is_buy_group" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "races" ALTER COLUMN "is_buy_group" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "races" ALTER COLUMN "required_transfer_fee" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "races" ALTER COLUMN "public_athlete_basic_info" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "races" ALTER COLUMN "vat_public" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "races" ALTER COLUMN "allow_transfer_zero_price_code" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "races" ALTER COLUMN "send_skip_liability_email" SET NOT NULL`,
    );
  }
}

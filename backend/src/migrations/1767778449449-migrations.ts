import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1767778449449 implements MigrationInterface {
  name = 'Migrations1767778449449';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ticket_types" ALTER COLUMN "price" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_types" ALTER COLUMN "type_name" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_types" ALTER COLUMN "max_participate" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_types" ALTER COLUMN "max_ticket_per_order" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_types" ALTER COLUMN "min_ticket_per_order" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_types" ALTER COLUMN "remained_ticket" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_types" ALTER COLUMN "sales_count" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_types" ALTER COLUMN "import_count" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_types" ALTER COLUMN "currency" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_types" ALTER COLUMN "is_show" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_types" ALTER COLUMN "claim_max_per_user" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_types" ALTER COLUMN "claim_counter" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_types" ALTER COLUMN "is_5bib" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_types" ALTER COLUMN "course_type" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ticket_types" ALTER COLUMN "course_type" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_types" ALTER COLUMN "is_5bib" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_types" ALTER COLUMN "claim_counter" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_types" ALTER COLUMN "claim_max_per_user" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_types" ALTER COLUMN "is_show" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_types" ALTER COLUMN "currency" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_types" ALTER COLUMN "import_count" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_types" ALTER COLUMN "sales_count" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_types" ALTER COLUMN "remained_ticket" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_types" ALTER COLUMN "min_ticket_per_order" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_types" ALTER COLUMN "max_ticket_per_order" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_types" ALTER COLUMN "max_participate" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_types" ALTER COLUMN "type_name" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_types" ALTER COLUMN "price" SET NOT NULL`,
    );
  }
}

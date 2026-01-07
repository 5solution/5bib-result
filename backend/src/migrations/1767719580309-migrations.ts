import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1767719580309 implements MigrationInterface {
  name = 'Migrations1767719580309';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "races" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "product_id" integer NOT NULL, "title" character varying(255) NOT NULL, "images" text, "season" character varying(20), "description" text, "brand" character varying(255), "status" character varying(50) NOT NULL, "hotline" character varying(50), "rule" text, "prefix" character varying(50), "location" character varying(255), "province" character varying(255), "district" character varying(255), "ward" character varying(255), "is_delete" boolean NOT NULL DEFAULT false, "metadata" jsonb, "auto_gen_bib" boolean NOT NULL DEFAULT false, "sapo_product_id" integer, "event_type" character varying(100), "event_start_date" TIMESTAMP, "event_end_date" TIMESTAMP, "event_category" character varying(100), "transfer_type" character varying(100), "url_name" character varying(255), "assert_transfer_fee" numeric(10,2), "logo_url" text, "term_id" integer, "email_template_id" integer, "is_show" boolean NOT NULL DEFAULT true, "event_director" character varying(50), "vnpay_listed" boolean NOT NULL DEFAULT false, "have_bib_name" boolean NOT NULL DEFAULT false, "blacklist_id" integer, "registration_start_time" TIMESTAMP, "registration_end_time" TIMESTAMP, "reassign_start_time" TIMESTAMP, "reassign_end_time" TIMESTAMP, "checkin_start_time" TIMESTAMP, "checkin_end_time" TIMESTAMP, "racekit_start_time" TIMESTAMP, "racekit_end_time" TIMESTAMP, "insurance_type" character varying(100), "insurance_agency_id" integer, "insurance_link_cert" text, "insurance_content" text, "insurance_race_code" character varying(100), "insurance_sport" character varying(100), "insurance_package" character varying(100), "insurance_limit" integer, "skip_register" boolean NOT NULL DEFAULT false, "ticket_phases" jsonb, "race_extension_id" integer, "race_extenstion" jsonb, "race_virtual_extension_id" integer, "race_virtual_extenstion" jsonb, "template_id" integer, "tenant_id" integer, "race_type" character varying(100), "create_by_id" integer, "racekit_location" character varying(255), "location_url" text, "racekit_location_url" text, "max_code_per_user" integer NOT NULL DEFAULT '1', "racekit_edit_enable" boolean NOT NULL DEFAULT false, "bib_strategy" character varying(50) NOT NULL DEFAULT 'DEFAULT', "race_kit_strategy" character varying(50) NOT NULL DEFAULT 'DEFAULT', "send_skip_liability_email" boolean NOT NULL DEFAULT false, "allow_transfer_zero_price_code" boolean NOT NULL DEFAULT false, "vat_public" boolean NOT NULL DEFAULT false, "public_athlete_basic_info" boolean NOT NULL DEFAULT false, "required_transfer_fee" boolean NOT NULL DEFAULT false, "is_buy_group" boolean NOT NULL DEFAULT false, "synced_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_33881cfa56e9c9598e55448b375" UNIQUE ("product_id"), CONSTRAINT "PK_ba7d19b382156bc33244426c597" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_24304cafe26a4a966615e04c90" ON "races" ("race_type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b87721c0134449f0c0eab0d47f" ON "races" ("province") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ee7445ffcf3c566f3147be8661" ON "races" ("season") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7956bb83a8eebc3c3cfa6dfade" ON "races" ("status") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_33881cfa56e9c9598e55448b37" ON "races" ("product_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "race_courses" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying(255) NOT NULL, "distance" character varying(50) NOT NULL, "prefix" character varying(50), "price" numeric(10,2), "race_id" integer NOT NULL, "variant_id" integer, "max_participate" integer NOT NULL DEFAULT '1', "max_ticket_per_order" integer NOT NULL DEFAULT '1', "min_ticket_per_order" integer NOT NULL DEFAULT '1', "open_for_sale_date_time" TIMESTAMP, "close_for_sale_date_time" TIMESTAMP, "medal_url" text, "ticket_image_url" text, "route_image_url" text, "route_map_image_url" text, "description" text, "race_result_url" text, "min_age" integer, "max_age" integer, "race_result_import_status" character varying(50) NOT NULL DEFAULT 'NONE', "exclude_bibs" jsonb, "course_type" character varying(50) NOT NULL DEFAULT 'ORDINARY', "min_bib" integer, "max_bib" integer, "nice_number_difficult" integer, "bib_image_template" text, "bib_image_template_fb" text, "story_image_template" text, "story_image_template_fb" text, "gain" character varying(100), "customize_fields" jsonb, "add_ons" jsonb, "max_ticket_per_user" integer, CONSTRAINT "PK_b078ad8ccad094f58435575db06" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_69b1b4a29eeb39ea5f7b177694" ON "race_courses" ("course_type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_335df91ec31f8fb3acb320a87f" ON "race_courses" ("variant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1272a5bde81d4a927cfeca3de5" ON "race_courses" ("race_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "ticket_types" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "price" numeric(10,2) NOT NULL, "type_name" character varying(100) NOT NULL, "unique_code" character varying(50) NOT NULL, "race_course_id" integer NOT NULL, "max_participate" integer NOT NULL DEFAULT '1', "max_ticket_per_order" integer NOT NULL DEFAULT '1', "min_ticket_per_order" integer NOT NULL DEFAULT '1', "remained_ticket" integer NOT NULL DEFAULT '0', "sales_count" integer NOT NULL DEFAULT '0', "import_count" integer NOT NULL DEFAULT '0', "image_url" text, "description" text, "currency" character varying(10) NOT NULL DEFAULT 'VND', "valid_from" TIMESTAMP, "valid_to" TIMESTAMP, "is_free" boolean NOT NULL DEFAULT false, "is_show" boolean NOT NULL DEFAULT true, "claim_max_per_user" integer NOT NULL DEFAULT '0', "claim_counter" integer NOT NULL DEFAULT '0', "is_5bib" boolean NOT NULL DEFAULT false, "ticket_image_url" text, "course_type" character varying(50) NOT NULL DEFAULT 'ORDINARY', "race_course_name" character varying(255), "variant_id" integer, "race_course_distance" character varying(50), CONSTRAINT "UQ_6c61f9815384a29ff2ea69e5394" UNIQUE ("unique_code"), CONSTRAINT "PK_5510ce7e18a4edc648c9fbfc283" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5eece6ab032b436a4d39a273e2" ON "ticket_types" ("type_name") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_6c61f9815384a29ff2ea69e539" ON "ticket_types" ("unique_code") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1abed02f1c34d7b46aa5e0e3ff" ON "ticket_types" ("race_course_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "race_courses" ADD CONSTRAINT "FK_1272a5bde81d4a927cfeca3de53" FOREIGN KEY ("race_id") REFERENCES "races"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_types" ADD CONSTRAINT "FK_1abed02f1c34d7b46aa5e0e3ff1" FOREIGN KEY ("race_course_id") REFERENCES "race_courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ticket_types" DROP CONSTRAINT "FK_1abed02f1c34d7b46aa5e0e3ff1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "race_courses" DROP CONSTRAINT "FK_1272a5bde81d4a927cfeca3de53"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1abed02f1c34d7b46aa5e0e3ff"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6c61f9815384a29ff2ea69e539"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5eece6ab032b436a4d39a273e2"`,
    );
    await queryRunner.query(`DROP TABLE "ticket_types"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1272a5bde81d4a927cfeca3de5"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_335df91ec31f8fb3acb320a87f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_69b1b4a29eeb39ea5f7b177694"`,
    );
    await queryRunner.query(`DROP TABLE "race_courses"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_33881cfa56e9c9598e55448b37"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7956bb83a8eebc3c3cfa6dfade"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ee7445ffcf3c566f3147be8661"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b87721c0134449f0c0eab0d47f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_24304cafe26a4a966615e04c90"`,
    );
    await queryRunner.query(`DROP TABLE "races"`);
  }
}

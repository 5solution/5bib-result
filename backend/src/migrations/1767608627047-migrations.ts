import { MigrationInterface, QueryRunner } from "typeorm";

export class Migrations1767608627047 implements MigrationInterface {
    name = 'Migrations1767608627047'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "race_results" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "bib" integer NOT NULL, "name" character varying(255) NOT NULL, "overall_rank" character varying(50), "overall_rank_numeric" integer, "gender_rank" character varying(50), "gender_rank_numeric" integer, "cat_rank" character varying(50), "cat_rank_numeric" integer, "gender" character varying(50), "category" character varying(100), "chip_time" character varying(50), "gun_time" character varying(50), "timing_point" character varying(255), "pace" character varying(50), "certi" character varying(255), "certificate" character varying(255), "overall_ranks" text, "gender_ranks" text, "chiptimes" text, "guntimes" text, "paces" text, "tods" text, "sectors" text, "overrank_live" character varying(50), "overrank_live_numeric" integer, "gap" character varying(50), "nationality" character varying(100), "nation" character varying(100), "race_id" integer NOT NULL, "course_id" character varying(50) NOT NULL, "distance" character varying(50) NOT NULL, "synced_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_732c6bc213dcae3c8c1d5a6f038" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_308b1e6cab0520e6185cc48b5f" ON "race_results" ("overall_rank_numeric") `);
        await queryRunner.query(`CREATE INDEX "IDX_9a524038581d442adf83dd9d24" ON "race_results" ("category") `);
        await queryRunner.query(`CREATE INDEX "IDX_b3d0764848ba5c44cf0568390d" ON "race_results" ("gender") `);
        await queryRunner.query(`CREATE INDEX "IDX_bbd8c7ccb69f5c0002fb7d1554" ON "race_results" ("course_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4b419ac9ad05914db36871d21a" ON "race_results" ("race_id", "course_id", "bib") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_4b419ac9ad05914db36871d21a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bbd8c7ccb69f5c0002fb7d1554"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b3d0764848ba5c44cf0568390d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9a524038581d442adf83dd9d24"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_308b1e6cab0520e6185cc48b5f"`);
        await queryRunner.query(`DROP TABLE "race_results"`);
    }

}

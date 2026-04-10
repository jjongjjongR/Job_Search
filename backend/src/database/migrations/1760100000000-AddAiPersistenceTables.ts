import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiPersistenceTables1760100000000
  implements MigrationInterface
{
  name = 'AddAiPersistenceTables1760100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."job_analysis_requests_status_enum" AS ENUM('PENDING', 'COMPLETED', 'FAILED')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."interview_sessions_sufficiency_status_enum" AS ENUM('SUFFICIENT', 'JD_ONLY', 'INSUFFICIENT')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."interview_sessions_status_enum" AS ENUM('IN_PROGRESS', 'FINISHED', 'FAILED', 'CANCELLED')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."interview_turns_question_type_enum" AS ENUM(
        'SELF_INTRO',
        'MOTIVATION',
        'JD_FIT',
        'PROJECT_DEEP_DIVE',
        'OTHER_PROJECT',
        'COLLAB_PROBLEM_SOLVING',
        'CLOSING',
        'FOLLOW_UP'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "job_analysis_requests" (
        "id" character varying(64) NOT NULL,
        "user_id" uuid NOT NULL,
        "source_url" text,
        "company_name" character varying(255) NOT NULL,
        "job_title" character varying(255) NOT NULL,
        "jd_text" text NOT NULL,
        "keywords_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "source_type" character varying(50),
        "status" "public"."job_analysis_requests_status_enum" NOT NULL DEFAULT 'PENDING',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_job_analysis_requests_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "cover_letter_reports" (
        "id" character varying(64) NOT NULL,
        "user_id" uuid NOT NULL,
        "job_analysis_request_id" character varying(64) NOT NULL,
        "company_name" character varying(255) NOT NULL,
        "job_title" character varying(255) NOT NULL,
        "total_score" integer NOT NULL,
        "summary_text" text NOT NULL,
        "strengths_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "weaknesses_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "guide_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cover_letter_reports_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "interview_sessions" (
        "id" character varying(64) NOT NULL,
        "user_id" uuid NOT NULL,
        "company_name" character varying(255) NOT NULL,
        "job_title" character varying(255) NOT NULL,
        "jd_text" text NOT NULL,
        "sufficiency_status" "public"."interview_sessions_sufficiency_status_enum" NOT NULL,
        "status" "public"."interview_sessions_status_enum" NOT NULL DEFAULT 'IN_PROGRESS',
        "total_question_count" integer NOT NULL DEFAULT 0,
        "answered_count" integer NOT NULL DEFAULT 0,
        "final_total_score" integer,
        "final_grade" character varying(50),
        "final_summary" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "finished_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_interview_sessions_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "interview_turns" (
        "id" character varying(64) NOT NULL,
        "session_id" character varying(64) NOT NULL,
        "turn_index" integer NOT NULL,
        "question_type" "public"."interview_turns_question_type_enum" NOT NULL,
        "question_text" text NOT NULL,
        "answer_video_title" character varying(255),
        "answer_full_text" text,
        "feedback_text" text,
        "nonverbal_summary_text" text,
        "content_score" numeric(5,2),
        "nonverbal_score" numeric(5,2),
        "total_score" numeric(5,2),
        "is_followup" boolean NOT NULL DEFAULT false,
        "stt_fallback_used" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_interview_turns_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_job_analysis_requests_user_id" ON "job_analysis_requests" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_cover_letter_reports_user_id" ON "cover_letter_reports" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_cover_letter_reports_job_analysis_request_id" ON "cover_letter_reports" ("job_analysis_request_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_interview_sessions_user_id" ON "interview_sessions" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_interview_turns_session_id" ON "interview_turns" ("session_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "job_analysis_requests"
      ADD CONSTRAINT "FK_job_analysis_requests_user_id"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "cover_letter_reports"
      ADD CONSTRAINT "FK_cover_letter_reports_user_id"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "cover_letter_reports"
      ADD CONSTRAINT "FK_cover_letter_reports_job_analysis_request_id"
      FOREIGN KEY ("job_analysis_request_id") REFERENCES "job_analysis_requests"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "interview_sessions"
      ADD CONSTRAINT "FK_interview_sessions_user_id"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "interview_turns"
      ADD CONSTRAINT "FK_interview_turns_session_id"
      FOREIGN KEY ("session_id") REFERENCES "interview_sessions"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "interview_turns" DROP CONSTRAINT "FK_interview_turns_session_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "interview_sessions" DROP CONSTRAINT "FK_interview_sessions_user_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "cover_letter_reports" DROP CONSTRAINT "FK_cover_letter_reports_job_analysis_request_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "cover_letter_reports" DROP CONSTRAINT "FK_cover_letter_reports_user_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "job_analysis_requests" DROP CONSTRAINT "FK_job_analysis_requests_user_id"
    `);
    await queryRunner.query(`
      DROP INDEX "public"."IDX_interview_turns_session_id"
    `);
    await queryRunner.query(`
      DROP INDEX "public"."IDX_interview_sessions_user_id"
    `);
    await queryRunner.query(`
      DROP INDEX "public"."IDX_cover_letter_reports_job_analysis_request_id"
    `);
    await queryRunner.query(`
      DROP INDEX "public"."IDX_cover_letter_reports_user_id"
    `);
    await queryRunner.query(`
      DROP INDEX "public"."IDX_job_analysis_requests_user_id"
    `);
    await queryRunner.query(`
      DROP TABLE "interview_turns"
    `);
    await queryRunner.query(`
      DROP TABLE "interview_sessions"
    `);
    await queryRunner.query(`
      DROP TABLE "cover_letter_reports"
    `);
    await queryRunner.query(`
      DROP TABLE "job_analysis_requests"
    `);
    await queryRunner.query(`
      DROP TYPE "public"."interview_turns_question_type_enum"
    `);
    await queryRunner.query(`
      DROP TYPE "public"."interview_sessions_status_enum"
    `);
    await queryRunner.query(`
      DROP TYPE "public"."interview_sessions_sufficiency_status_enum"
    `);
    await queryRunner.query(`
      DROP TYPE "public"."job_analysis_requests_status_enum"
    `);
  }
}

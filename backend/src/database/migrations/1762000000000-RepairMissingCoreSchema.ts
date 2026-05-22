import { MigrationInterface, QueryRunner } from 'typeorm';

export class RepairMissingCoreSchema1762000000000
  implements MigrationInterface
{
  name = 'RepairMissingCoreSchema1762000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 2026-05-23 신규: 비어 있던 InitialSchema가 이미 실행 처리된 EC2 DB에서 누락된 핵심 테이블을 복구
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_analysis_requests_status_enum') THEN
          CREATE TYPE "public"."job_analysis_requests_status_enum" AS ENUM('PENDING', 'COMPLETED', 'FAILED');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'interview_sessions_sufficiency_status_enum') THEN
          CREATE TYPE "public"."interview_sessions_sufficiency_status_enum" AS ENUM('SUFFICIENT', 'JD_ONLY', 'INSUFFICIENT');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'interview_sessions_status_enum') THEN
          CREATE TYPE "public"."interview_sessions_status_enum" AS ENUM('IN_PROGRESS', 'FINISHED', 'FAILED', 'CANCELLED');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'interview_turns_question_type_enum') THEN
          CREATE TYPE "public"."interview_turns_question_type_enum" AS ENUM(
            'SELF_INTRO',
            'MOTIVATION',
            'JD_FIT',
            'PROJECT_DEEP_DIVE',
            'OTHER_PROJECT',
            'COLLAB_PROBLEM_SOLVING',
            'CLOSING',
            'FOLLOW_UP'
          );
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "username" character varying NOT NULL,
        "display_name" character varying NOT NULL,
        "password_hash" character varying NOT NULL,
        "role" character varying NOT NULL DEFAULT 'USER',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "UQ_users_username" UNIQUE ("username")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "post" (
        "id" SERIAL NOT NULL,
        "title" character varying NOT NULL,
        "content" character varying NOT NULL,
        "author" character varying NOT NULL,
        "likes" integer NOT NULL DEFAULT 0,
        "views" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_post_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "post_like" (
        "id" SERIAL NOT NULL,
        "post_id" integer NOT NULL,
        "user_id" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_post_like_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_post_like_post_id_user_id" UNIQUE ("post_id", "user_id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "comment" (
        "id" SERIAL NOT NULL,
        "content" character varying NOT NULL,
        "author" character varying NOT NULL,
        "postId" integer NOT NULL,
        CONSTRAINT "PK_comment_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "file_entity" (
        "id" SERIAL NOT NULL,
        "title" character varying NOT NULL,
        "uploader" character varying NOT NULL,
        "filename" character varying NOT NULL,
        "originalname" character varying NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_file_entity_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "dataroom" (
        "id" SERIAL NOT NULL,
        "title" character varying NOT NULL,
        "description" character varying NOT NULL,
        "uploader" character varying NOT NULL,
        "file_id" integer,
        CONSTRAINT "PK_dataroom_id" PRIMARY KEY ("id"),
        CONSTRAINT "REL_dataroom_file_id" UNIQUE ("file_id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "job_analysis_requests" (
        "id" character varying(64) NOT NULL,
        "user_id" uuid NOT NULL,
        "source_url" text,
        "company_name" character varying(255) NOT NULL,
        "job_title" character varying(255) NOT NULL,
        "jd_text" text NOT NULL,
        "keywords_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "skills_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "source_type" character varying(50),
        "status" "public"."job_analysis_requests_status_enum" NOT NULL DEFAULT 'PENDING',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_job_analysis_requests_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cover_letter_reports" (
        "id" character varying(64) NOT NULL,
        "user_id" uuid NOT NULL,
        "job_analysis_request_id" character varying(64) NOT NULL,
        "company_name" character varying(255) NOT NULL,
        "job_title" character varying(255) NOT NULL,
        "total_score" integer NOT NULL,
        "jd_alignment_score" integer,
        "job_fit_score" integer,
        "confidence" real,
        "verified_jd_keywords_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "summary_text" text NOT NULL,
        "revised_draft_text" text,
        "question_scores_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "rubric_scores_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "rag_evidence_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "strengths_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "weaknesses_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "guide_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cover_letter_reports_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "interview_sessions" (
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
      CREATE TABLE IF NOT EXISTS "interview_turns" (
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

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_job_analysis_requests_user_id" ON "job_analysis_requests" ("user_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_cover_letter_reports_user_id" ON "cover_letter_reports" ("user_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_cover_letter_reports_job_analysis_request_id" ON "cover_letter_reports" ("job_analysis_request_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_interview_sessions_user_id" ON "interview_sessions" ("user_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_interview_turns_session_id" ON "interview_turns" ("session_id")`);

    await this.addConstraintIfMissing(
      queryRunner,
      'FK_post_like_post_id',
      `ALTER TABLE "post_like" ADD CONSTRAINT "FK_post_like_post_id" FOREIGN KEY ("post_id") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await this.addConstraintIfMissing(
      queryRunner,
      'FK_comment_post_id',
      `ALTER TABLE "comment" ADD CONSTRAINT "FK_comment_post_id" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await this.addConstraintIfMissing(
      queryRunner,
      'FK_dataroom_file_id',
      `ALTER TABLE "dataroom" ADD CONSTRAINT "FK_dataroom_file_id" FOREIGN KEY ("file_id") REFERENCES "file_entity"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await this.addConstraintIfMissing(
      queryRunner,
      'FK_job_analysis_requests_user_id',
      `ALTER TABLE "job_analysis_requests" ADD CONSTRAINT "FK_job_analysis_requests_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await this.addConstraintIfMissing(
      queryRunner,
      'FK_cover_letter_reports_user_id',
      `ALTER TABLE "cover_letter_reports" ADD CONSTRAINT "FK_cover_letter_reports_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await this.addConstraintIfMissing(
      queryRunner,
      'FK_cover_letter_reports_job_analysis_request_id',
      `ALTER TABLE "cover_letter_reports" ADD CONSTRAINT "FK_cover_letter_reports_job_analysis_request_id" FOREIGN KEY ("job_analysis_request_id") REFERENCES "job_analysis_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await this.addConstraintIfMissing(
      queryRunner,
      'FK_interview_sessions_user_id',
      `ALTER TABLE "interview_sessions" ADD CONSTRAINT "FK_interview_sessions_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await this.addConstraintIfMissing(
      queryRunner,
      'FK_interview_turns_session_id',
      `ALTER TABLE "interview_turns" ADD CONSTRAINT "FK_interview_turns_session_id" FOREIGN KEY ("session_id") REFERENCES "interview_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {}

  private async addConstraintIfMissing(
    queryRunner: QueryRunner,
    constraintName: string,
    sql: string,
  ) {
    const existing = await queryRunner.query(
      `SELECT 1 FROM pg_constraint WHERE conname = $1`,
      [constraintName],
    );
    if (existing.length === 0) {
      await queryRunner.query(sql);
    }
  }
}

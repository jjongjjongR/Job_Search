import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCoverLetterScoringFields1760400000000
  implements MigrationInterface
{
  name = 'AddCoverLetterScoringFields1760400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cover_letter_reports"
      ADD COLUMN IF NOT EXISTS "jd_alignment_score" integer,
      ADD COLUMN IF NOT EXISTS "job_fit_score" integer,
      ADD COLUMN IF NOT EXISTS "question_scores_json" jsonb NOT NULL DEFAULT '[]'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cover_letter_reports"
      DROP COLUMN IF EXISTS "question_scores_json",
      DROP COLUMN IF EXISTS "job_fit_score",
      DROP COLUMN IF EXISTS "jd_alignment_score"
    `);
  }
}

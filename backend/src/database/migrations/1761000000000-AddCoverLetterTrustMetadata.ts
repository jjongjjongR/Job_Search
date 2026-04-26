import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCoverLetterTrustMetadata1761000000000
  implements MigrationInterface
{
  name = 'AddCoverLetterTrustMetadata1761000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cover_letter_reports"
      ADD COLUMN IF NOT EXISTS "confidence" real,
      ADD COLUMN IF NOT EXISTS "verified_jd_keywords_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS "rubric_scores_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS "rag_evidence_json" jsonb NOT NULL DEFAULT '[]'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cover_letter_reports"
      DROP COLUMN IF EXISTS "rag_evidence_json",
      DROP COLUMN IF EXISTS "rubric_scores_json",
      DROP COLUMN IF EXISTS "verified_jd_keywords_json",
      DROP COLUMN IF EXISTS "confidence"
    `);
  }
}

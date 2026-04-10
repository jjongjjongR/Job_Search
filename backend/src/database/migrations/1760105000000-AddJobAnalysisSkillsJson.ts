import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddJobAnalysisSkillsJson1760105000000
  implements MigrationInterface
{
  name = 'AddJobAnalysisSkillsJson1760105000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "job_analysis_requests"
      ADD COLUMN "skills_json" jsonb NOT NULL DEFAULT '[]'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "job_analysis_requests"
      DROP COLUMN "skills_json"
    `);
  }
}

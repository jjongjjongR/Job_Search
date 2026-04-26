import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCoverLetterRevisedDraft1760500000000
  implements MigrationInterface
{
  name = 'AddCoverLetterRevisedDraft1760500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cover_letter_reports"
      ADD COLUMN "revised_draft_text" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cover_letter_reports"
      DROP COLUMN "revised_draft_text"
    `);
  }
}

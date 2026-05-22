import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1760000000000 implements MigrationInterface {
  name = 'InitialSchema1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 2026-05-23 수정: production DB에서 synchronize 없이도 기본 서비스 테이블이 생성되도록 초기 schema를 실제 SQL로 채움
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "dataroom"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "file_entity"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "comment"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "post_like"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "post"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }

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

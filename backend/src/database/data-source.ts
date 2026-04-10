import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Post } from '../post/entities/post.entity';
import { PostLike } from '../post/entities/post-like.entity';
import { Comment } from '../post/comment/entities/comment.entity';
import { FileEntity } from '../files/entities/file.entity';
import { Dataroom } from '../dataroom/entities/dataroom.entity';
import { JobAnalysisRequest } from '../jobs/entities/job-analysis-request.entity';
import { CoverLetterReport } from '../cover-letter/entities/cover-letter-report.entity';
import { InterviewSession } from '../interview/entities/interview-session.entity';
import { InterviewTurn } from '../interview/entities/interview-turn.entity';

// 2026-04-10 신규: TypeORM CLI도 backend/.env.local 과 .env 값을 읽도록 간단한 로더 추가
function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

// 2026-04-10 신규: migration 검증 시 기본값이 아니라 실제 로컬 환경변수를 우선 사용
loadEnvFile(path.resolve(process.cwd(), '.env.local'));
loadEnvFile(path.resolve(process.cwd(), '.env'));

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'world_job_search',
  entities: [
    User,
    Post,
    PostLike,
    Comment,
    FileEntity,
    Dataroom,
    JobAnalysisRequest,
    CoverLetterReport,
    InterviewSession,
    InterviewTurn,
  ],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});

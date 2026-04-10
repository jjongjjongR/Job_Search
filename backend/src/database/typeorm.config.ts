import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { JobAnalysisRequest } from '../jobs/entities/job-analysis-request.entity';
import { CoverLetterReport } from '../cover-letter/entities/cover-letter-report.entity';
import { InterviewSession } from '../interview/entities/interview-session.entity';
import { InterviewTurn } from '../interview/entities/interview-turn.entity';

export function getTypeOrmConfig(
  configService: ConfigService,
): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: configService.getOrThrow<string>('database.host'),
    port: configService.getOrThrow<number>('database.port'),
    username: configService.getOrThrow<string>('database.username'),
    password: configService.getOrThrow<string>('database.password'),
    database: configService.getOrThrow<string>('database.name'),
    entities: [
      User,
      JobAnalysisRequest,
      CoverLetterReport,
      InterviewSession,
      InterviewTurn,
    ],
    synchronize: configService.getOrThrow<boolean>('database.synchronize'),
    autoLoadEntities: true,
  };
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiClientModule } from '../ai-client/ai-client.module';
import { FilesModule } from '../files/files.module';
import { JobsModule } from '../jobs/jobs.module';
import { InterviewController } from './interview.controller';
import { InterviewService } from './interview.service';
import { InterviewSession } from './entities/interview-session.entity';
import { InterviewTurn } from './entities/interview-turn.entity';

@Module({
  imports: [
    AiClientModule,
    FilesModule,
    JobsModule,
    TypeOrmModule.forFeature([InterviewSession, InterviewTurn]),
  ],
  controllers: [InterviewController],
  providers: [InterviewService],
})
export class InterviewModule {}

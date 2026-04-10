import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiClientModule } from '../ai-client/ai-client.module';
import { CoverLetterController } from './cover-letter.controller';
import { CoverLetterService } from './cover-letter.service';
import { CoverLetterReport } from './entities/cover-letter-report.entity';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [
    AiClientModule,
    JobsModule,
    TypeOrmModule.forFeature([CoverLetterReport]),
  ],
  controllers: [CoverLetterController],
  providers: [CoverLetterService],
})
export class CoverLetterModule {}

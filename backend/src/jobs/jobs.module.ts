import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiClientModule } from '../ai-client/ai-client.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { JobAnalysisRequest } from './entities/job-analysis-request.entity';

@Module({
  imports: [AiClientModule, TypeOrmModule.forFeature([JobAnalysisRequest])],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}

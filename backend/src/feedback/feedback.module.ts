// feedback.module.ts
import { Module } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { FeedbackController } from './feedback.controller';
import { OpenAIService } from '../openai/openai.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule], // 필요
  controllers: [FeedbackController],
  providers: [FeedbackService, OpenAIService],
})
export class FeedbackModule {}

// src/interview/interview.module.ts

import { Module } from '@nestjs/common';
import { InterviewService } from './interview.service';
import { InterviewController } from './interview.controller';
import { OpenAIService } from '../openai/openai.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [InterviewController],
  providers: [InterviewService, OpenAIService],
})
export class InterviewModule {} // ✅ 클래스 이름을 정확히 모듈 이름으로!

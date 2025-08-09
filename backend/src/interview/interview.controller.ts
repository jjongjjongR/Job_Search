// src/interview/interview.controller.ts

import { Body, Controller, Post } from '@nestjs/common';
import { InterviewService } from './interview.service';
import { OpenAIRole } from './interview.types';

@Controller('interview')
export class InterviewController {
  constructor(private readonly interviewService: InterviewService) {}

  @Post('next')
  async getNextReply(
    @Body() body: { history: Array<{ role: OpenAIRole; content: string }> }, // 명확히 지정
  ) {
    // 그대로 전달
    return this.interviewService.generateNext(body.history);
  }
}

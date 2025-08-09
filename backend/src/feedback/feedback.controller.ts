// src/feedback/feedback.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { FeedbackService, CoverLetterFeedback } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post('cover-letter')
  async getCoverLetterFeedback(
    @Body() dto: CreateFeedbackDto,
  ): Promise<CoverLetterFeedback> {
    return await this.feedbackService.getCoverLetterFeedback(dto.content);
  }
}

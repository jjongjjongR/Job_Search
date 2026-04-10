import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtUser } from '../auth/interfaces/jwt-user.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  AnalyzeJobRequestDto,
  JobAnalysisDetailResponseDto,
  AnalyzeJobResponseDto,
} from './dto/analyze-job.dto';
import { JobsService } from './jobs.service';

@ApiTags('jobs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  // 2026-04-10 신규: 프론트가 호출하는 공고 분석 공개 엔드포인트 추가
  @Post('analyze')
  @ApiOperation({ summary: '공고 분석 요청' })
  @ApiCreatedResponse({ type: AnalyzeJobResponseDto })
  analyze(
    @CurrentUser() currentUser: JwtUser,
    @Body() payload: AnalyzeJobRequestDto,
  ): Promise<AnalyzeJobResponseDto> {
    return this.jobsService.analyze(currentUser.userId, payload);
  }

  // 2026-04-10 신규: 저장된 공고 분석 결과를 다시 조회하는 공개 엔드포인트 추가
  @Get('analysis-requests/:jobAnalysisRequestId')
  @ApiOperation({ summary: '공고 분석 결과 재조회' })
  @ApiOkResponse({ type: JobAnalysisDetailResponseDto })
  getAnalysis(
    @CurrentUser() currentUser: JwtUser,
    @Param('jobAnalysisRequestId') jobAnalysisRequestId: string,
  ): Promise<JobAnalysisDetailResponseDto> {
    return this.jobsService.getAnalysisById(
      currentUser.userId,
      jobAnalysisRequestId,
    );
  }
}

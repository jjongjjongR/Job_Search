import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtUser } from '../auth/interfaces/jwt-user.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  CoverLetterFeedbackRequestDto,
  CoverLetterFeedbackResponseDto,
} from './dto/cover-letter-feedback.dto';
import { CoverLetterService } from './cover-letter.service';
import { CoverLetterReportDetailDto, CoverLetterReportSummaryDto } from './dto/cover-letter-report.dto';

@ApiTags('ai-cover-letter')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai/cover-letter')
export class CoverLetterController {
  constructor(private readonly coverLetterService: CoverLetterService) {}

  // 2026-04-10 신규: 프론트가 호출하는 자소서 피드백 공개 엔드포인트 추가
  @Post('feedback')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'coverLetterFile', maxCount: 1 },
        { name: 'resumeFile', maxCount: 1 },
        { name: 'portfolioFile', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: {
          fileSize: 20 * 1024 * 1024,
        },
      },
    ),
  )
  @ApiOperation({ summary: '자소서 피드백 생성' })
  @ApiCreatedResponse({ type: CoverLetterFeedbackResponseDto })
  createFeedback(
    @CurrentUser() currentUser: JwtUser,
    @Body() payload: CoverLetterFeedbackRequestDto,
    @UploadedFiles()
    files?: {
      coverLetterFile?: Express.Multer.File[];
      resumeFile?: Express.Multer.File[];
      portfolioFile?: Express.Multer.File[];
    },
  ): Promise<CoverLetterFeedbackResponseDto> {
    return this.coverLetterService.createFeedback(currentUser.userId, payload, {
      coverLetterFile: files?.coverLetterFile?.[0],
      resumeFile: files?.resumeFile?.[0],
      portfolioFile: files?.portfolioFile?.[0],
    });
  }

  @Get('reports')
  @ApiOperation({ summary: '자소서 리포트 목록 조회' })
  @ApiOkResponse({ type: CoverLetterReportSummaryDto, isArray: true })
  listReports(
    @CurrentUser() currentUser: JwtUser,
  ): Promise<CoverLetterReportSummaryDto[]> {
    return this.coverLetterService.listReports(currentUser.userId);
  }

  @Get('reports/:reportId')
  @ApiOperation({ summary: '자소서 리포트 단건 조회' })
  @ApiOkResponse({ type: CoverLetterReportDetailDto })
  getReport(
    @CurrentUser() currentUser: JwtUser,
    @Param('reportId') reportId: string,
  ): Promise<CoverLetterReportDetailDto> {
    return this.coverLetterService.getReport(currentUser.userId, reportId);
  }
}

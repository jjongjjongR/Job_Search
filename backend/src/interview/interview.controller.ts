import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
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
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import * as path from 'path';
import { JwtUser } from '../auth/interfaces/jwt-user.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  FinishInterviewSessionRequestDto,
  FinishInterviewSessionResponseDto,
  InterviewSessionDetailDto,
  InterviewSessionSummaryDto,
  InterviewTurnDto,
  StartInterviewSessionRequestDto,
  StartInterviewSessionResponseDto,
  SubmitInterviewAnswerRequestDto,
  SubmitInterviewAnswerResponseDto,
  UploadInterviewAnswerResponseDto,
} from './dto/interview-session.dto';
import { InterviewService } from './interview.service';

@ApiTags('ai-interview')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai/interview/sessions')
export class InterviewController {
  constructor(private readonly interviewService: InterviewService) {}

  // 2026.04.25 신규: 11단계 실제 STT 흐름을 위해 면접 답변 영상을 temp storage에 업로드한다
  @Post('uploads')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 120 * 1024 * 1024,
      },
      fileFilter: (_req, file, callback) => {
        const extension = path.extname(file.originalname).toLowerCase();
        const allowedExtensions = ['.mp4', '.mov', '.webm', '.m4a', '.mp3', '.wav'];
        if (!allowedExtensions.includes(extension)) {
          callback(
            new BadRequestException('면접 답변 업로드는 영상/오디오 파일만 허용됩니다.'),
            false,
          );
          return;
        }
        callback(null, true);
      },
      storage: memoryStorage(),
    }),
  )
  @ApiOperation({ summary: '면접 답변 임시 업로드' })
  @ApiCreatedResponse({ type: UploadInterviewAnswerResponseDto })
  uploadAnswerVideo(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadInterviewAnswerResponseDto> {
    if (!file) {
      throw new BadRequestException('업로드할 면접 답변 파일이 필요합니다.');
    }

    return this.interviewService.uploadAnswerVideo(file);
  }

  // 2026-04-10 신규: 면접 세션 시작 공개 API 추가
  @Post('start')
  @ApiOperation({ summary: '면접 세션 시작' })
  @ApiCreatedResponse({ type: StartInterviewSessionResponseDto })
  startSession(
    @CurrentUser() currentUser: JwtUser,
    @Body() payload: StartInterviewSessionRequestDto,
  ): Promise<StartInterviewSessionResponseDto> {
    return this.interviewService.startSession(currentUser.userId, payload);
  }

  // 2026-04-10 신규: 면접 답변 제출 공개 API 추가
  @Post(':sessionId/answers')
  @ApiOperation({ summary: '면접 답변 제출' })
  @ApiCreatedResponse({ type: SubmitInterviewAnswerResponseDto })
  submitAnswer(
    @CurrentUser() currentUser: JwtUser,
    @Param('sessionId') sessionId: string,
    @Body() payload: SubmitInterviewAnswerRequestDto,
  ): Promise<SubmitInterviewAnswerResponseDto> {
    return this.interviewService.submitAnswer(
      currentUser.userId,
      sessionId,
      payload,
    );
  }

  // 2026-04-10 신규: 면접 세션 종료 공개 API 추가
  @Post(':sessionId/finish')
  @ApiOperation({ summary: '면접 세션 종료' })
  @ApiCreatedResponse({ type: FinishInterviewSessionResponseDto })
  finishSession(
    @CurrentUser() currentUser: JwtUser,
    @Param('sessionId') sessionId: string,
    @Body() payload: FinishInterviewSessionRequestDto,
  ): Promise<FinishInterviewSessionResponseDto> {
    return this.interviewService.finishSession(
      currentUser.userId,
      sessionId,
      payload,
    );
  }

  // 2026-04-10 신규: 현재 메모리 기준 면접 세션 목록 조회 API 추가
  @Get()
  @ApiOperation({ summary: '면접 세션 목록 조회' })
  @ApiOkResponse({ type: InterviewSessionSummaryDto, isArray: true })
  listSessions(
    @CurrentUser() currentUser: JwtUser,
  ): Promise<InterviewSessionSummaryDto[]> {
    return this.interviewService.listSessions(currentUser.userId);
  }

  // 2026-04-10 신규: 현재 메모리 기준 면접 세션 단건 조회 API 추가
  @Get(':sessionId')
  @ApiOperation({ summary: '면접 세션 단건 조회' })
  @ApiOkResponse({ type: InterviewSessionDetailDto })
  getSession(
    @CurrentUser() currentUser: JwtUser,
    @Param('sessionId') sessionId: string,
  ): Promise<InterviewSessionDetailDto> {
    return this.interviewService.getSession(currentUser.userId, sessionId);
  }

  // 2026-04-10 신규: 현재 메모리 기준 면접 세션 턴 목록 조회 API 추가
  @Get(':sessionId/turns')
  @ApiOperation({ summary: '면접 세션 턴 목록 조회' })
  @ApiOkResponse({ type: InterviewTurnDto, isArray: true })
  getTurns(
    @CurrentUser() currentUser: JwtUser,
    @Param('sessionId') sessionId: string,
  ): Promise<InterviewTurnDto[]> {
    return this.interviewService.getTurns(currentUser.userId, sessionId);
  }
}

import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiClientService } from '../ai-client/ai-client.service';
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
import { InterviewSession } from './entities/interview-session.entity';
import { InterviewTurn } from './entities/interview-turn.entity';
import {
  DocumentSufficiencyStatus,
  InterviewQuestionType,
  InterviewSessionStatus,
} from '../ai/entities/ai.enums';
import { JobsService } from '../jobs/jobs.service';
import { FilesService } from '../files/files.service';
import { extractTextFromStoredFile } from '../cover-letter/utils/document-text-extractor';

interface InterviewSessionRecord extends InterviewSessionSummaryDto {
  userId: string;
  maxQuestionCount: number;
  documentSufficiency: string;
  currentQuestion: {
    questionType: string;
    questionText: string;
  };
}

@Injectable()
export class InterviewService {
  // 2026-04-10 신규: 현재 질문 상태는 Redis 전 단계이므로 메모리에 유지
  private readonly sessions = new Map<string, InterviewSessionRecord>();

  // 2026-04-10 신규: 턴 조회 API를 위해 세션별 턴 목록 저장소를 추가
  private readonly sessionTurns = new Map<string, InterviewTurnDto[]>();

  constructor(
    private readonly aiClientService: AiClientService,
    private readonly jobsService: JobsService,
    private readonly filesService: FilesService,
    @InjectRepository(InterviewSession)
    private readonly interviewSessionRepository: Repository<InterviewSession>,
    @InjectRepository(InterviewTurn)
    private readonly interviewTurnRepository: Repository<InterviewTurn>,
  ) {}

  // 2026-04-10 신규: 시작 요청을 FastAPI에 전달하고 공개 세션 ID를 함께 만든다
  async startSession(
    userId: string,
    payload: StartInterviewSessionRequestDto,
  ): Promise<StartInterviewSessionResponseDto> {
    const resolvedStartInput = await this.resolveStartInput(payload);
    const sessionId = this.createSessionId();
    const response = await this.aiClientService.startInterview({
      sessionId,
      userId,
      companyName: resolvedStartInput.companyName,
      positionName: resolvedStartInput.positionName,
      jdText: resolvedStartInput.jdText,
      documents: resolvedStartInput.documents,
    });
    const createdAt = new Date().toISOString();

    this.sessions.set(sessionId, {
      sessionId,
      userId,
      companyName: resolvedStartInput.companyName,
      positionName: resolvedStartInput.positionName,
      status: response.sessionState.status,
      currentQuestionNumber: response.sessionState.currentQuestionNumber,
      createdAt,
      finishedAt: null,
      maxQuestionCount: 10,
      documentSufficiency: response.documentSufficiency,
      currentQuestion: {
        questionType: response.question.questionType,
        questionText: response.question.questionText,
      },
    });
    this.sessionTurns.set(sessionId, []);

    // 2026-04-10 신규: 면접 세션 메타 정보를 영구 저장 테이블에 기록
    await this.interviewSessionRepository.save(
      this.interviewSessionRepository.create({
        id: sessionId,
        userId,
        companyName: resolvedStartInput.companyName,
        jobTitle: resolvedStartInput.positionName,
        jdText: resolvedStartInput.jdText,
        sufficiencyStatus:
          response.documentSufficiency as DocumentSufficiencyStatus,
        status: response.sessionState.status as InterviewSessionStatus,
        totalQuestionCount: 10,
        answeredCount: 0,
        finalTotalScore: null,
        finalGrade: null,
        finalSummary: null,
        finishedAt: null,
      }),
    );

    return {
      sessionId,
      documentSufficiency: response.documentSufficiency,
      status: response.sessionState.status,
      currentQuestionNumber: response.sessionState.currentQuestionNumber,
      maxQuestionCount: 10,
      question: {
        questionType: response.question.questionType,
        questionText: response.question.questionText,
      },
    };
  }

  // 2026.04.25 신규: 면접 답변 영상을 temp storage에 저장하고 storage key를 반환
  async uploadAnswerVideo(
    file: Express.Multer.File,
  ): Promise<UploadInterviewAnswerResponseDto> {
    const storedFile = await this.filesService.storeFile(
      file,
      'interview_answer_upload',
    );

    return {
      storageKey: storedFile.storageKey,
      originalName: file.originalname,
      size: storedFile.size,
    };
  }

  // 2026-04-10 신규: 답변 요청을 FastAPI에 전달하고 턴 기록을 메모리에 남긴다
  async submitAnswer(
    userId: string,
    sessionId: string,
    payload: SubmitInterviewAnswerRequestDto,
  ): Promise<SubmitInterviewAnswerResponseDto> {
    const session = this.getOwnedSession(userId, sessionId);
    const response = await this.aiClientService.processInterviewAnswer({
      userId,
      sessionId,
      turnNumber: payload.turnNumber,
      answerType: payload.answerType,
      answerVideoStorageKey: payload.answerVideoStorageKey,
      answerText: payload.answerText,
      transcriptHint: payload.transcriptHint,
      videoDurationSeconds: payload.videoDurationSeconds,
      hasAudio: payload.hasAudio,
      severeNoise: payload.severeNoise,
      faceDetectedRatio: payload.faceDetectedRatio,
      multiFaceDetected: payload.multiFaceDetected,
      lowLight: payload.lowLight,
      obstructionDetected: payload.obstructionDetected,
      gazeStable: payload.gazeStable,
    });

    const turn: InterviewTurnDto = {
      turnNumber: payload.turnNumber,
      evaluation: {
        answerFullText: response.answerFullText,
        feedbackText: response.feedbackText,
        nonverbalSummaryText: response.nonverbalSummaryText,
        visionResultStatus: response.visionResultStatus,
      },
      decision: {
        type: response.decision.type,
        message: response.decision.message,
        retryCount: response.decision.retryCount ?? null,
        followUpCountForCurrentQuestion:
          response.decision.followUpCountForCurrentQuestion,
        nextQuestion: response.decision.nextQuestion
          ? {
              questionType: response.decision.nextQuestion.questionType,
              questionText: response.decision.nextQuestion.questionText,
            }
          : null,
      },
      createdAt: new Date().toISOString(),
    };

    // 2026-04-21 수정: 재업로드 요청/텍스트 전환 요청은 아직 정상 턴이 아니므로 저장하지 않음
    if (
      response.decision.type === 'RETRY_UPLOAD' ||
      response.decision.type === 'REQUEST_TEXT'
    ) {
      return {
        sessionId,
        turnNumber: payload.turnNumber,
        evaluation: turn.evaluation,
        decision: turn.decision,
      };
    }

    const turns = this.sessionTurns.get(sessionId) ?? [];
    this.sessionTurns.set(sessionId, [...turns, turn]);

    // 2026-04-10 수정: turn 저장은 save 대신 insert로 명시적으로 수행해 DB 반영을 더 안정화
    await this.interviewTurnRepository.insert({
      id: randomUUID(),
      sessionId,
      turnIndex: payload.turnNumber,
      questionType: (session.currentQuestion.questionType ??
        'FOLLOW_UP') as InterviewQuestionType,
      questionText: session.currentQuestion.questionText,
      answerVideoTitle: payload.answerVideoStorageKey ?? null,
      answerFullText: response.answerFullText,
      feedbackText: response.feedbackText,
      nonverbalSummaryText: response.nonverbalSummaryText,
      // 2026.04.25 수정: 13단계 최종 리포트 계산을 위해 턴 점수를 DB에 함께 저장
      contentScore: response.contentScore ?? null,
      // 2026.04.25 수정: 13단계 최종 리포트 계산을 위해 턴 점수를 DB에 함께 저장
      nonverbalScore: response.nonverbalScore ?? null,
      // 2026.04.25 수정: 13단계 최종 리포트 계산을 위해 턴 점수를 DB에 함께 저장
      totalScore: response.totalScore ?? null,
      isFollowup: session.currentQuestion.questionType === 'FOLLOW_UP',
      sttFallbackUsed: payload.answerType === 'TEXT',
    });

    if (response.decision.type === 'NEXT_QUESTION') {
      session.currentQuestionNumber += 1;
    }

    if (response.decision.nextQuestion) {
      session.currentQuestion = {
        questionType: response.decision.nextQuestion.questionType,
        questionText: response.decision.nextQuestion.questionText,
      };
    }

    if (response.decision.type === 'FINISH_SESSION') {
      session.status = 'FINISHED';
      session.finishedAt = new Date().toISOString();
    }

    this.sessions.set(sessionId, session);
    await this.interviewSessionRepository.update(
      { id: sessionId },
      {
        status: session.status as InterviewSessionStatus,
        answeredCount: payload.turnNumber,
      },
    );

    return {
      sessionId,
      turnNumber: payload.turnNumber,
      evaluation: turn.evaluation,
      decision: turn.decision,
    };
  }

  // 2026.04.25 신규: 자료 기준인 jobAnalysisRequestId 재사용 시작 흐름과 직접 입력 fallback을 함께 지원
  private async resolveStartInput(payload: StartInterviewSessionRequestDto) {
    const documents = await this.resolveDocuments(payload);

    if (payload.jobAnalysisRequestId) {
      const jobAnalysis = await this.jobsService.findAnalysisById(
        payload.jobAnalysisRequestId,
      );
      if (!jobAnalysis) {
        throw new NotFoundException('공고 분석 결과를 찾을 수 없습니다.');
      }

      return {
        companyName: jobAnalysis.companyName,
        positionName: jobAnalysis.positionName,
        jdText: jobAnalysis.jdText,
        documents,
      };
    }

    if (!payload.companyName || !payload.positionName || !payload.jdText) {
      throw new BadRequestException(
        '면접 시작에는 jobAnalysisRequestId 또는 회사명/직무명/JD 본문이 필요합니다.',
      );
    }

    return {
      companyName: payload.companyName,
      positionName: payload.positionName,
      jdText: payload.jdText,
      documents,
    };
  }

  // 2026.04.25 신규: 선택 문서 ID가 있으면 저장된 파일에서 텍스트를 다시 읽어 면접 기준 문서로 사용
  private async resolveDocuments(payload: StartInterviewSessionRequestDto) {
    const directDocuments = payload.documents ?? {};

    return {
      coverLetterText:
        directDocuments.coverLetterText ??
        (await this.resolveDocumentTextById(payload.coverLetterDocumentId)),
      resumeText:
        directDocuments.resumeText ??
        (await this.resolveDocumentTextById(payload.resumeDocumentId)),
      portfolioText:
        directDocuments.portfolioText ??
        (await this.resolveDocumentTextById(payload.portfolioDocumentId)),
    };
  }

  // 2026.04.25 신규: doc-001 / 1 같은 문서 식별자를 저장된 파일 ID로 해석해 텍스트를 추출
  private async resolveDocumentTextById(documentId?: string) {
    if (!documentId) {
      return undefined;
    }

    const matched = documentId.match(/(\d+)$/);
    if (!matched) {
      return undefined;
    }

    const file = await this.filesService.findOne(Number(matched[1]));
    if (!file) {
      return undefined;
    }

    const resolved = await this.filesService.resolveStoredFile(file.filename);
    if (!resolved) {
      return undefined;
    }

    try {
      const extractedText = await extractTextFromStoredFile(
        resolved.absolutePath,
        file.originalname,
      );
      return extractedText || undefined;
    } catch {
      return undefined;
    }
  }

  // 2026-04-10 신규: 종료 요청을 FastAPI에 전달하고 세션 상태를 마감 처리한다
  async finishSession(
    userId: string,
    sessionId: string,
    payload: FinishInterviewSessionRequestDto,
  ): Promise<FinishInterviewSessionResponseDto> {
    const session = this.getOwnedSession(userId, sessionId);
    const response = await this.aiClientService.finishInterview({
      userId,
      sessionId,
      reason: payload.reason,
    });

    session.status = response.status;
    session.finishedAt = response.finishedAt;
    this.sessions.set(sessionId, session);
    await this.interviewSessionRepository.update(
      { id: sessionId },
      {
        status: response.status as InterviewSessionStatus,
        finalTotalScore: response.finalReport.totalScore,
        finalGrade: response.finalReport.grade,
        finalSummary: response.finalReport.summary,
        finishedAt: new Date(response.finishedAt),
      },
    );

    const turns = await this.interviewTurnRepository.find({
      where: { sessionId },
      order: { turnIndex: 'ASC' },
    });
    const finalReport = this.buildDetailedFinalReport(
      {
        totalScore: response.finalReport.totalScore,
        grade: response.finalReport.grade,
        summary: response.finalReport.summary,
        strengths: response.finalReport.strengths,
        weaknesses: response.finalReport.weaknesses,
        practiceDirections: response.finalReport.practiceDirections,
      },
      turns,
    );

    return {
      sessionId,
      status: response.status,
      finishedAt: response.finishedAt,
      finalReport,
    };
  }

  // 2026-04-10 신규: 현재 사용자 세션 목록만 필터링해서 반환
  async listSessions(userId: string): Promise<InterviewSessionSummaryDto[]> {
    const sessions = await this.interviewSessionRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    return sessions.map((session) => ({
      sessionId: session.id,
      companyName: session.companyName,
      positionName: session.jobTitle,
      status: session.status,
      currentQuestionNumber: session.answeredCount + 1,
      createdAt: session.createdAt.toISOString(),
      finishedAt: session.finishedAt?.toISOString() ?? null,
    }));
  }

  // 2026-04-10 신규: 현재 사용자 세션 단건 정보를 반환
  async getSession(
    userId: string,
    sessionId: string,
  ): Promise<InterviewSessionDetailDto> {
    const session = await this.interviewSessionRepository.findOneBy({
      id: sessionId,
      userId,
    });
    if (!session) {
      throw new NotFoundException('면접 세션을 찾을 수 없습니다.');
    }

    const detail: InterviewSessionDetailDto = {
      sessionId: session.id,
      companyName: session.companyName,
      positionName: session.jobTitle,
      status: session.status,
      currentQuestionNumber: session.answeredCount + 1,
      createdAt: session.createdAt.toISOString(),
      finishedAt: session.finishedAt?.toISOString() ?? null,
      finalReport: null,
    };

    if (session.status === InterviewSessionStatus.FINISHED && session.finalTotalScore !== null) {
      const turns = await this.interviewTurnRepository.find({
        where: { sessionId },
        order: { turnIndex: 'ASC' },
      });
      detail.finalReport = this.buildDetailedFinalReport(
        {
          totalScore: session.finalTotalScore,
          grade:
            session.finalGrade ??
            this.buildInterviewGrade(session.finalTotalScore),
          summary:
            session.finalSummary ??
            '면접이 종료되어 저장된 턴 기준으로 최종 리포트를 다시 구성했습니다.',
          strengths: this.buildStrengthsFromTurns(turns),
          weaknesses: this.buildWeaknessesFromTurns(turns),
          practiceDirections: this.buildPracticeDirectionsFromTurns(turns),
        },
        turns,
      );
    }

    return detail;
  }

  // 2026-04-10 신규: 현재 사용자 세션의 턴 목록만 반환
  async getTurns(userId: string, sessionId: string): Promise<InterviewTurnDto[]> {
    await this.getSession(userId, sessionId);
    // 2026-04-15 수정: 현재 프로세스에서 생성된 턴은 실제 AI decision 값을 메모리 기록 기준으로 우선 반환
    const inMemoryTurns = this.sessionTurns.get(sessionId);
    if (inMemoryTurns && inMemoryTurns.length > 0) {
      return inMemoryTurns;
    }

    const turns = await this.interviewTurnRepository.find({
      where: { sessionId },
      order: { turnIndex: 'ASC' },
    });

    return turns.map((turn) => ({
      turnNumber: turn.turnIndex,
      evaluation: {
        answerFullText: turn.answerFullText ?? '',
        feedbackText: turn.feedbackText ?? '',
        nonverbalSummaryText: turn.nonverbalSummaryText ?? '',
        visionResultStatus: turn.nonverbalSummaryText ? 'SKIPPED' : 'SKIPPED',
      },
      decision: {
        type: turn.isFollowup ? 'FOLLOW_UP' : 'NEXT_QUESTION',
        message: turn.feedbackText ?? '',
        followUpCountForCurrentQuestion: turn.isFollowup ? 1 : 0,
        nextQuestion: null,
      },
      createdAt: turn.createdAt.toISOString(),
    }));
  }

  // 2026-04-10 신규: 세션 소유권을 확인하면서 조회하는 내부 헬퍼
  private getOwnedSession(
    userId: string,
    sessionId: string,
  ): InterviewSessionRecord {
    const session = this.sessions.get(sessionId);

    if (!session || session.userId !== userId) {
      throw new NotFoundException('면접 세션을 찾을 수 없습니다.');
    }

    return session;
  }

  // 2026-04-10 신규: 사람이 읽기 쉬운 면접 세션 ID 형식 유지
  private createSessionId(): string {
    return `ivs-${randomUUID()}`;
  }

  // 2026.04.25 신규: 최종 리포트 응답에 질문-답변과 턴별 피드백을 함께 묶는다
  private buildDetailedFinalReport(
    baseReport: {
      totalScore: number;
      grade: string;
      summary: string;
      strengths: string[];
      weaknesses: string[];
      practiceDirections: string[];
    },
    turns: InterviewTurn[],
  ) {
    return {
      ...baseReport,
      questionAnswers: turns.map((turn) => ({
        turnNumber: turn.turnIndex,
        questionText: turn.questionText,
        answerFullText: turn.answerFullText ?? '',
      })),
      turnFeedbacks: turns.map((turn) => ({
        turnNumber: turn.turnIndex,
        questionText: turn.questionText,
        feedbackText: turn.feedbackText ?? '',
        nonverbalSummaryText: turn.nonverbalSummaryText ?? '',
      })),
    };
  }

  // 2026.04.25 신규: 세션 재조회 시 저장된 턴 기준으로 강점 3개를 다시 구성
  private buildStrengthsFromTurns(turns: InterviewTurn[]) {
    const strengths: string[] = [];
    const averageContent = this.calculateAverageScore(turns, 'contentScore');
    const averageNonverbal = this.calculateAverageScore(turns, 'nonverbalScore');
    const answerLengthAverage = Math.round(
      turns.reduce((sum, turn) => sum + (turn.answerFullText?.length ?? 0), 0) /
        Math.max(turns.length, 1),
    );

    if (averageContent >= 70) {
      strengths.push('질문 의도에 맞는 내용 전달이 전반적으로 안정적입니다.');
    }
    if (averageNonverbal >= 8) {
      strengths.push('비언어 전달이 비교적 안정적으로 유지되었습니다.');
    }
    if (answerLengthAverage >= 90) {
      strengths.push('답변 분량과 경험 설명의 기본 뼈대가 갖춰져 있습니다.');
    }

    return this.fillReportItems(strengths, [
      '질문 흐름을 따라가며 면접을 끝까지 진행한 점이 좋습니다.',
      '직무 경험을 답변 안에 녹여내려는 시도가 보였습니다.',
      '핵심 경험을 바탕으로 답변을 이어간 점이 좋았습니다.',
    ]);
  }

  // 2026.04.25 신규: 저장된 피드백 문장 기반으로 보완점 3개를 다시 구성
  private buildWeaknessesFromTurns(turns: InterviewTurn[]) {
    const source = turns.map((turn) => turn.feedbackText ?? '').join(' ');
    const weaknesses: string[] = [];

    if (source.includes('역할') || source.includes('기여')) {
      weaknesses.push('본인 역할과 기여도를 더 선명하게 설명할 필요가 있습니다.');
    }
    if (source.includes('성과') || source.includes('근거')) {
      weaknesses.push('성과와 근거를 더 구체적으로 말할 필요가 있습니다.');
    }
    if (source.includes('직무')) {
      weaknesses.push('직무 연결 문장을 더 분명하게 정리할 필요가 있습니다.');
    }
    if (source.includes('구체') || source.includes('과정')) {
      weaknesses.push('과정 설명을 더 구체적으로 말할 필요가 있습니다.');
    }
    if (source.includes('협업') || source.includes('소통')) {
      weaknesses.push('협업 과정과 소통 방식을 더 또렷하게 설명할 필요가 있습니다.');
    }

    return this.fillReportItems(weaknesses, [
      '본인 역할과 기여도를 더 선명하게 설명할 필요가 있습니다.',
      '성과와 근거를 더 구체적으로 말할 필요가 있습니다.',
      '직무 연결 문장을 더 분명하게 정리할 필요가 있습니다.',
    ]);
  }

  // 2026.04.25 신규: 보완점에 대응하는 연습 방향 3개를 다시 구성
  private buildPracticeDirectionsFromTurns(turns: InterviewTurn[]) {
    const source = turns.map((turn) => turn.feedbackText ?? '').join(' ');
    const directions: string[] = [];

    if (source.includes('역할') || source.includes('기여')) {
      directions.push('답변 첫 문장에서 맡은 역할과 책임 범위를 먼저 말해 보세요.');
    }
    if (source.includes('성과') || source.includes('근거')) {
      directions.push('성과는 숫자, 비교 결과, 개선 폭으로 한 번 더 정리해 보세요.');
    }
    if (source.includes('직무')) {
      directions.push('경험 설명 마지막을 지원 직무와의 연결 문장으로 마무리해 보세요.');
    }
    if (source.includes('구체') || source.includes('과정')) {
      directions.push('문제 상황, 해결 방법, 결과 순서로 답변 구조를 다시 잡아 보세요.');
    }
    if (source.includes('협업') || source.includes('소통')) {
      directions.push('협업 상황에서는 상대와 어떻게 조율했는지 한 문장 더 추가해 보세요.');
    }

    return this.fillReportItems(directions, [
      '답변 첫 문장에서 역할과 상황을 먼저 정리해 보세요.',
      '성과는 숫자나 비교 결과로 한 번 더 구체화해 보세요.',
      '문단 마지막을 지원 직무와의 연결 문장으로 마무리해 보세요.',
    ]);
  }

  private calculateAverageScore(
    turns: InterviewTurn[],
    key: 'contentScore' | 'nonverbalScore',
  ) {
    const values = turns
      .map((turn) => {
        const value = turn[key];
        if (typeof value === 'number') {
          return value;
        }
        if (typeof value === 'string') {
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
      })
      .filter((value): value is number => value !== null);
    if (!values.length) {
      return 0;
    }
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }

  private fillReportItems(items: string[], defaults: string[]) {
    const result = [...new Set(items)];
    for (const item of defaults) {
      if (result.length >= 3) {
        break;
      }
      if (!result.includes(item)) {
        result.push(item);
      }
    }
    return result.slice(0, 3);
  }

  private buildInterviewGrade(totalScore: number) {
    if (totalScore >= 90) {
      return '매우 우수';
    }
    if (totalScore >= 80) {
      return '우수';
    }
    if (totalScore >= 70) {
      return '보통';
    }
    if (totalScore >= 60) {
      return '보완 필요';
    }
    return '집중 보완 필요';
  }
}

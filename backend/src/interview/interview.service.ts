import { randomUUID } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiClientService } from '../ai-client/ai-client.service';
import {
  FinishInterviewSessionRequestDto,
  FinishInterviewSessionResponseDto,
  InterviewSessionSummaryDto,
  InterviewTurnDto,
  StartInterviewSessionRequestDto,
  StartInterviewSessionResponseDto,
  SubmitInterviewAnswerRequestDto,
  SubmitInterviewAnswerResponseDto,
} from './dto/interview-session.dto';
import { InterviewSession } from './entities/interview-session.entity';
import { InterviewTurn } from './entities/interview-turn.entity';
import {
  DocumentSufficiencyStatus,
  InterviewQuestionType,
  InterviewSessionStatus,
} from '../ai/entities/ai.enums';

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
    const sessionId = this.createSessionId();
    const response = await this.aiClientService.startInterview({
      sessionId,
      userId,
      companyName: payload.companyName,
      positionName: payload.positionName,
      jdText: payload.jdText,
      documents: payload.documents,
    });
    const createdAt = new Date().toISOString();

    this.sessions.set(sessionId, {
      sessionId,
      userId,
      companyName: payload.companyName,
      positionName: payload.positionName,
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
        companyName: payload.companyName,
        jobTitle: payload.positionName,
        jdText: payload.jdText,
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
    });

    const turn: InterviewTurnDto = {
      turnNumber: payload.turnNumber,
      evaluation: {
        answerFullText: response.answerFullText,
        feedbackText: response.feedbackText,
        nonverbalSummaryText: response.nonverbalSummaryText,
      },
      decision: {
        type: response.decision.type,
        message: response.decision.message,
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
      contentScore: null,
      nonverbalScore: null,
      totalScore: null,
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

    return {
      sessionId,
      status: response.status,
      finishedAt: response.finishedAt,
      finalReport: {
        totalScore: response.finalReport.totalScore,
        grade: response.finalReport.grade,
        summary: response.finalReport.summary,
        strengths: response.finalReport.strengths,
        weaknesses: response.finalReport.weaknesses,
        practiceDirections: response.finalReport.practiceDirections,
      },
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
  ): Promise<InterviewSessionSummaryDto> {
    const session = await this.interviewSessionRepository.findOneBy({
      id: sessionId,
      userId,
    });
    if (!session) {
      throw new NotFoundException('면접 세션을 찾을 수 없습니다.');
    }

    return {
      sessionId: session.id,
      companyName: session.companyName,
      positionName: session.jobTitle,
      status: session.status,
      currentQuestionNumber: session.answeredCount + 1,
      createdAt: session.createdAt.toISOString(),
      finishedAt: session.finishedAt?.toISOString() ?? null,
    };
  }

  // 2026-04-10 신규: 현재 사용자 세션의 턴 목록만 반환
  async getTurns(userId: string, sessionId: string): Promise<InterviewTurnDto[]> {
    await this.getSession(userId, sessionId);
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
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class InterviewDocumentsDto {
  // 2026-04-10 신규: 자기소개서 텍스트를 면접 시작 입력 구조에 포함
  @ApiPropertyOptional({ description: '자소서 텍스트' })
  @IsOptional()
  @IsString()
  coverLetterText?: string;

  // 2026-04-10 신규: 이력서 텍스트를 면접 시작 입력 구조에 포함
  @ApiPropertyOptional({ description: '이력서 텍스트' })
  @IsOptional()
  @IsString()
  resumeText?: string;

  // 2026-04-10 신규: 포트폴리오 텍스트를 면접 시작 입력 구조에 포함
  @ApiPropertyOptional({ description: '포트폴리오 텍스트' })
  @IsOptional()
  @IsString()
  portfolioText?: string;
}

export class StartInterviewSessionRequestDto {
  // 2026.04.25 수정: 자료 기준에 맞춰 저장된 공고 분석 결과 ID로 면접 세션 시작 가능하게 추가
  @ApiPropertyOptional({ description: '공고 분석 요청 ID', example: 'jar-001' })
  @IsOptional()
  @IsString()
  jobAnalysisRequestId?: string;

  // 2026.04.25 신규: 자료 기준 선택 문서 ID 입력을 받을 수 있게 추가
  @ApiPropertyOptional({ description: '이력서 문서 ID', example: 'doc-resume-001' })
  @IsOptional()
  @IsString()
  resumeDocumentId?: string;

  // 2026.04.25 신규: 자료 기준 선택 문서 ID 입력을 받을 수 있게 추가
  @ApiPropertyOptional({ description: '자소서 문서 ID', example: 'doc-cover-001' })
  @IsOptional()
  @IsString()
  coverLetterDocumentId?: string;

  // 2026.04.25 신규: 자료 기준 선택 문서 ID 입력을 받을 수 있게 추가
  @ApiPropertyOptional({ description: '포트폴리오 문서 ID', example: 'doc-portfolio-001' })
  @IsOptional()
  @IsString()
  portfolioDocumentId?: string;

  // 2026-04-10 신규: 면접 시작 시 회사명을 직접 입력하는 fallback 경로 유지
  @ApiPropertyOptional({ description: '회사명', example: 'OpenAI Korea' })
  @IsOptional()
  @IsString()
  companyName?: string;

  // 2026-04-10 신규: 면접 시작 시 직무명을 직접 입력하는 fallback 경로 유지
  @ApiPropertyOptional({ description: '직무명', example: 'Backend Engineer' })
  @IsOptional()
  @IsString()
  positionName?: string;

  // 2026-04-10 신규: JD 본문 직접 입력 fallback 유지
  @ApiPropertyOptional({ description: 'JD 본문' })
  @IsOptional()
  @IsString()
  jdText?: string;

  // 2026-04-10 신규: 참고 문서 텍스트 묶음을 입력 구조에 포함
  @ApiPropertyOptional({ type: InterviewDocumentsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => InterviewDocumentsDto)
  documents?: InterviewDocumentsDto;
}

export class UploadInterviewAnswerResponseDto {
  // 2026.04.25 신규: 면접 답변 임시 업로드 후 사용할 storage key를 응답에 포함
  @ApiProperty({
    description: '임시 저장된 면접 답변 영상 storage key',
    example: 'temp/interview_answer_upload/1714000000000-answer.webm',
  })
  @IsString()
  storageKey!: string;

  // 2026.04.25 신규: 원본 파일명을 응답에 포함
  @ApiProperty({ description: '원본 파일명', example: 'answer.webm' })
  @IsString()
  originalName!: string;

  // 2026.04.25 신규: 파일 크기를 응답에 포함
  @ApiProperty({ description: '파일 크기(byte)', example: 1048576 })
  @IsInt()
  size!: number;
}

export class InterviewQuestionDto {
  // 2026-04-10 신규: 질문 타입을 응답 구조로 문서화
  @ApiProperty({ description: '질문 타입', example: 'SELF_INTRO' })
  @IsString()
  questionType!: string;

  // 2026-04-10 신규: 실제 질문 문장을 응답 구조로 문서화
  @ApiProperty({ description: '질문 문장' })
  @IsString()
  questionText!: string;
}

export class StartInterviewSessionResponseDto {
  // 2026-04-10 신규: 공개 API에서 사용할 세션 ID를 응답에 포함
  @ApiProperty({ description: '면접 세션 ID', example: 'ivs-001' })
  @IsString()
  sessionId!: string;

  // 2026-04-10 신규: 문서 충분도 판단 결과를 응답에 포함
  @ApiProperty({ description: '문서 충분도', example: 'SUFFICIENT' })
  @IsString()
  documentSufficiency!: string;

  // 2026-04-10 신규: 세션 상태를 응답에 포함
  @ApiProperty({ description: '세션 상태', example: 'IN_PROGRESS' })
  @IsString()
  status!: string;

  // 2026-04-10 신규: 현재 질문 번호를 응답에 포함
  @ApiProperty({ description: '현재 질문 번호', example: 1 })
  @IsInt()
  currentQuestionNumber!: number;

  // 2026-04-10 신규: 현재 단계 기본 최대 질문 수를 응답에 노출
  @ApiProperty({ description: '최대 질문 수', example: 10 })
  @IsInt()
  maxQuestionCount!: number;

  // 2026-04-10 신규: 첫 질문 정보를 응답에 포함
  @ApiProperty({ type: InterviewQuestionDto })
  @ValidateNested()
  @Type(() => InterviewQuestionDto)
  question!: InterviewQuestionDto;
}

export class SubmitInterviewAnswerRequestDto {
  // 2026-04-10 신규: 현재 답변 턴 번호를 검증
  @ApiProperty({ description: '답변 턴 번호', example: 1 })
  @IsInt()
  turnNumber!: number;

  // 2026-04-10 신규: VIDEO 또는 TEXT 답변 타입만 허용
  @ApiProperty({ description: '답변 타입', example: 'TEXT' })
  @IsString()
  @IsIn(['VIDEO', 'TEXT'])
  answerType!: 'VIDEO' | 'TEXT';

  // 2026-04-10 신규: 영상 답변일 때 사용할 저장 키를 선택 입력으로 추가
  @ApiPropertyOptional({ description: '영상 저장 키' })
  @IsOptional()
  @IsString()
  answerVideoStorageKey?: string;

  // 2026-04-10 신규: 텍스트 답변일 때 사용할 본문을 선택 입력으로 추가
  @ApiPropertyOptional({ description: '텍스트 답변 본문' })
  @IsOptional()
  @IsString()
  answerText?: string;

  // 2026-04-21 신규: 영상 전사 힌트를 테스트와 임시 STT fallback 검증에 사용
  @ApiPropertyOptional({ description: '임시 전사 텍스트 또는 테스트 힌트' })
  @IsOptional()
  @IsString()
  transcriptHint?: string;

  // 2026-04-21 신규: 11단계 규칙용 영상 길이 메타데이터
  @ApiPropertyOptional({ description: '영상 길이(초)', example: 12.5 })
  @IsOptional()
  videoDurationSeconds?: number;

  // 2026-04-21 신규: 오디오 유무를 STT fallback 판단에 반영
  @ApiPropertyOptional({ description: '오디오 포함 여부', example: true })
  @IsOptional()
  hasAudio?: boolean;

  // 2026-04-21 신규: 심한 잡음 여부를 STT fallback 판단에 반영
  @ApiPropertyOptional({ description: '심한 잡음 여부', example: false })
  @IsOptional()
  severeNoise?: boolean;

  // 2026-04-21 신규: Vision 최소 평가용 얼굴 유지율
  @ApiPropertyOptional({ description: '얼굴 유지율', example: 0.84 })
  @IsOptional()
  faceDetectedRatio?: number;

  // 2026-04-21 신규: 다중 얼굴 검출 여부
  @ApiPropertyOptional({ description: '다중 얼굴 검출 여부', example: false })
  @IsOptional()
  multiFaceDetected?: boolean;

  // 2026-04-21 신규: 저조도 여부
  @ApiPropertyOptional({ description: '저조도 여부', example: false })
  @IsOptional()
  lowLight?: boolean;

  // 2026-04-21 신규: 가림 여부
  @ApiPropertyOptional({ description: '가림 여부', example: false })
  @IsOptional()
  obstructionDetected?: boolean;

  // 2026-04-21 신규: 정면 응시 proxy 안정 여부
  @ApiPropertyOptional({ description: '정면 응시 proxy 안정 여부', example: true })
  @IsOptional()
  gazeStable?: boolean;
}

export class InterviewDecisionNextQuestionDto {
  // 2026-04-10 신규: 다음 질문 타입을 응답 구조에 포함
  @ApiProperty({ description: '다음 질문 타입', example: 'FOLLOW_UP' })
  @IsString()
  questionType!: string;

  // 2026-04-10 신규: 다음 질문 문장을 응답 구조에 포함
  @ApiProperty({ description: '다음 질문 문장' })
  @IsString()
  questionText!: string;
}

export class InterviewDecisionDto {
  // 2026-04-10 신규: 답변 처리 후 다음 액션 타입을 응답에 포함
  @ApiProperty({ description: '다음 진행 타입', example: 'FOLLOW_UP' })
  @IsString()
  type!: string;

  // 2026-04-10 신규: 사용자 안내 메시지를 응답에 포함
  @ApiProperty({ description: '안내 메시지' })
  @IsString()
  message!: string;

  // 2026-04-10 신규: 현재 질문의 꼬리질문 횟수를 선택 응답으로 노출
  @ApiPropertyOptional({ description: '현재 질문 꼬리질문 횟수', example: 1 })
  @IsOptional()
  @IsInt()
  followUpCountForCurrentQuestion?: number | null;

  // 2026-04-21 신규: 재업로드/텍스트 전환 판단 시 현재 재시도 횟수를 응답에 노출
  @ApiPropertyOptional({ description: '현재 재시도 횟수', example: 1 })
  @IsOptional()
  @IsInt()
  retryCount?: number | null;

  // 2026-04-10 신규: 다음 질문 정보가 있을 때 함께 반환
  @ApiPropertyOptional({ type: InterviewDecisionNextQuestionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => InterviewDecisionNextQuestionDto)
  nextQuestion?: InterviewDecisionNextQuestionDto | null;
}

export class InterviewEvaluationDto {
  // 2026-04-10 신규: 사용자에게 다시 보여줄 답변 텍스트를 응답에 포함
  @ApiProperty({ description: '정리된 답변 텍스트' })
  @IsString()
  answerFullText!: string;

  // 2026-04-10 신규: 답변 피드백을 응답에 포함
  @ApiProperty({ description: '답변 피드백' })
  @IsString()
  feedbackText!: string;

  // 2026-04-10 신규: 비언어 평가 요약을 응답에 포함
  @ApiProperty({ description: '비언어 평가 요약' })
  @IsString()
  nonverbalSummaryText!: string;

  // 2026.04.25 신규: 자료 기준 응답에 맞춰 Vision 상태값을 함께 노출
  @ApiProperty({ description: 'Vision 보조 평가 상태', example: 'VALID' })
  @IsString()
  visionResultStatus!: string;
}

export class SubmitInterviewAnswerResponseDto {
  // 2026-04-10 신규: 어떤 세션의 답변 결과인지 바로 알 수 있게 세션 ID 포함
  @ApiProperty({ description: '면접 세션 ID', example: 'ivs-001' })
  @IsString()
  sessionId!: string;

  // 2026-04-10 신규: 어떤 턴의 답변 결과인지 응답에 포함
  @ApiProperty({ description: '답변 턴 번호', example: 1 })
  @IsInt()
  turnNumber!: number;

  // 2026-04-10 신규: 답변 평가 결과 묶음을 응답에 포함
  @ApiProperty({ type: InterviewEvaluationDto })
  @ValidateNested()
  @Type(() => InterviewEvaluationDto)
  evaluation!: InterviewEvaluationDto;

  // 2026-04-10 신규: 다음 진행 결정 정보를 응답에 포함
  @ApiProperty({ type: InterviewDecisionDto })
  @ValidateNested()
  @Type(() => InterviewDecisionDto)
  decision!: InterviewDecisionDto;
}

export class FinishInterviewSessionRequestDto {
  // 2026-04-10 신규: 면접 종료 사유를 요청에서 받도록 정의
  @ApiProperty({ description: '종료 사유', example: 'USER_FINISHED' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class InterviewFinalReportDto {
  // 2026-04-10 신규: 최종 점수를 응답에 포함
  @ApiProperty({ description: '최종 총점', example: 81 })
  @IsInt()
  totalScore!: number;

  // 2026-04-10 신규: 최종 등급을 응답에 포함
  @ApiProperty({ description: '최종 등급', example: '우수' })
  @IsString()
  grade!: string;

  // 2026-04-10 신규: 최종 요약을 응답에 포함
  @ApiProperty({ description: '최종 요약' })
  @IsString()
  summary!: string;

  // 2026-04-10 신규: 강점 목록을 응답에 포함
  @ApiProperty({ description: '강점 목록', type: [String] })
  @IsArray()
  strengths!: string[];

  // 2026-04-10 신규: 보완점 목록을 응답에 포함
  @ApiProperty({ description: '보완점 목록', type: [String] })
  @IsArray()
  weaknesses!: string[];

  // 2026-04-10 신규: 연습 방향 목록을 응답에 포함
  @ApiProperty({ description: '연습 방향 목록', type: [String] })
  @IsArray()
  practiceDirections!: string[];

  // 2026.04.25 신규: 자료 기준 질문 목록-답변을 최종 리포트 응답에 포함
  @ApiProperty({
    description: '질문 목록-답변',
    type: [Object],
    example: [{ turnNumber: 1, questionText: '1분 자기소개 부탁드립니다.', answerFullText: '...' }],
  })
  @IsArray()
  questionAnswers!: Array<{
    turnNumber: number;
    questionText: string;
    answerFullText: string;
  }>;

  // 2026.04.25 신규: 자료 기준 턴별 피드백을 최종 리포트 응답에 포함
  @ApiProperty({
    description: '턴별 피드백',
    type: [Object],
    example: [
      {
        turnNumber: 1,
        questionText: '1분 자기소개 부탁드립니다.',
        feedbackText: '...',
        nonverbalSummaryText: '...',
      },
    ],
  })
  @IsArray()
  turnFeedbacks!: Array<{
    turnNumber: number;
    questionText: string;
    feedbackText: string;
    nonverbalSummaryText: string;
  }>;
}

export class FinishInterviewSessionResponseDto {
  // 2026-04-10 신규: 종료된 세션 ID를 응답에 포함
  @ApiProperty({ description: '면접 세션 ID', example: 'ivs-001' })
  @IsString()
  sessionId!: string;

  // 2026-04-10 신규: 세션 종료 상태를 응답에 포함
  @ApiProperty({ description: '세션 상태', example: 'FINISHED' })
  @IsString()
  status!: string;

  // 2026-04-10 신규: 종료 시각을 응답에 포함
  @ApiProperty({ description: '종료 시각 ISO 문자열' })
  @IsString()
  finishedAt!: string;

  // 2026-04-10 신규: 최종 리포트를 응답에 포함
  @ApiProperty({ type: InterviewFinalReportDto })
  @ValidateNested()
  @Type(() => InterviewFinalReportDto)
  finalReport!: InterviewFinalReportDto;
}

export class InterviewSessionSummaryDto {
  // 2026-04-10 신규: 목록 화면에서 사용할 세션 요약 ID 추가
  @ApiProperty({ description: '면접 세션 ID', example: 'ivs-001' })
  @IsString()
  sessionId!: string;

  // 2026-04-10 신규: 회사명을 목록 응답에 포함
  @ApiProperty({ description: '회사명', example: 'OpenAI Korea' })
  @IsString()
  companyName!: string;

  // 2026-04-10 신규: 직무명을 목록 응답에 포함
  @ApiProperty({ description: '직무명', example: 'Backend Engineer' })
  @IsString()
  positionName!: string;

  // 2026-04-10 신규: 세션 상태를 목록 응답에 포함
  @ApiProperty({ description: '세션 상태', example: 'IN_PROGRESS' })
  @IsString()
  status!: string;

  // 2026-04-10 신규: 현재 질문 번호를 목록 응답에 포함
  @ApiProperty({ description: '현재 질문 번호', example: 1 })
  @IsInt()
  currentQuestionNumber!: number;

  // 2026-04-10 신규: 생성 시각을 목록 응답에 포함
  @ApiProperty({ description: '생성 시각 ISO 문자열' })
  @IsString()
  createdAt!: string;

  // 2026-04-10 신규: 종료 시각이 있으면 목록 응답에 포함
  @ApiPropertyOptional({ description: '종료 시각 ISO 문자열' })
  @IsOptional()
  @IsString()
  finishedAt?: string | null;
}

export class InterviewSessionDetailDto extends InterviewSessionSummaryDto {
  // 2026.04.25 신규: 종료된 세션은 재조회 시 최종 리포트를 함께 반환
  @ApiPropertyOptional({ type: InterviewFinalReportDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => InterviewFinalReportDto)
  finalReport?: InterviewFinalReportDto | null;
}

export class InterviewTurnDto {
  // 2026-04-10 신규: 턴 번호를 조회 응답에 포함
  @ApiProperty({ description: '답변 턴 번호', example: 1 })
  @IsInt()
  turnNumber!: number;

  // 2026-04-10 신규: 평가 결과를 조회 응답에 포함
  @ApiProperty({ type: InterviewEvaluationDto })
  @ValidateNested()
  @Type(() => InterviewEvaluationDto)
  evaluation!: InterviewEvaluationDto;

  // 2026-04-10 신규: 다음 진행 결정을 조회 응답에 포함
  @ApiProperty({ type: InterviewDecisionDto })
  @ValidateNested()
  @Type(() => InterviewDecisionDto)
  decision!: InterviewDecisionDto;

  // 2026-04-10 신규: 생성 시각을 조회 응답에 포함
  @ApiProperty({ description: '생성 시각 ISO 문자열' })
  @IsString()
  createdAt!: string;
}

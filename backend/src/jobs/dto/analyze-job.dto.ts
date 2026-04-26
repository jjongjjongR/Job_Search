import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl } from 'class-validator';

export class AnalyzeJobRequestDto {
  @ApiPropertyOptional({
    description: '분석할 공고 URL(jobUrl 별칭)',
    example: 'https://example.com/jobs/backend-engineer',
  })
  @IsOptional()
  @IsUrl()
  jobPostingUrl?: string;

  // 2026-04-10 신규: URL 기반 공고 분석 요청을 Swagger와 검증 규칙으로 노출
  @ApiPropertyOptional({
    description: '분석할 공고 URL',
    example: 'https://example.com/jobs/backend-engineer',
  })
  @IsOptional()
  @IsUrl()
  jobUrl?: string;

  // 2026-04-10 신규: URL 분석 실패 또는 수동 입력용 회사명 필드 추가
  @ApiPropertyOptional({
    description: '수동 입력 회사명',
    example: 'OpenAI Korea',
  })
  @IsOptional()
  @IsString()
  manualCompanyName?: string;

  // 2026-04-10 신규: 수동 입력용 직무명 필드 추가
  @ApiPropertyOptional({
    description: '수동 입력 직무명',
    example: 'Backend Engineer',
  })
  @IsOptional()
  @IsString()
  manualPositionName?: string;

  // 2026-04-10 신규: 단계별 진행가이드 명칭에 맞춘 manualJobTitle 별칭 추가
  @ApiPropertyOptional({
    description: '수동 입력 직무명(manualJobTitle 별칭)',
    example: 'Backend Engineer',
  })
  @IsOptional()
  @IsString()
  manualJobTitle?: string;

  // 2026-04-10 신규: 수동 입력용 JD 본문 필드 추가
  @ApiPropertyOptional({
    description: '수동 입력 JD 본문',
    example: '백엔드 서비스 개발, PostgreSQL 경험 우대',
  })
  @IsOptional()
  @IsString()
  manualJdText?: string;
}

export class AnalyzeJobResponseDto {
  // 2026-04-10 신규: 공개 API에서 재조회용 분석 요청 ID를 반환
  @ApiProperty({ description: '공고 분석 요청 ID', example: 'jar-001' })
  jobAnalysisRequestId!: string;

  // 2026-04-10 신규: 정리된 회사명을 응답 문서에 노출
  @ApiProperty({ description: '회사명', example: 'OpenAI Korea' })
  companyName!: string;

  // 2026-04-10 신규: 정리된 직무명을 응답 문서에 노출
  @ApiProperty({ description: '직무명', example: 'Backend Engineer' })
  positionName!: string;

  // 2026-04-10 신규: 정리된 JD 본문을 그대로 반환
  @ApiProperty({
    description: '정리된 JD 본문',
    example: '백엔드 서비스 개발, PostgreSQL 경험 우대',
  })
  jdText!: string;

  // 2026-04-10 신규: 추출된 핵심 기술 목록을 응답에 포함
  @ApiProperty({
    description: '추출 기술 목록',
    example: ['FastAPI', 'PostgreSQL', 'Redis'],
    type: [String],
  })
  extractedSkills!: string[];

  // 2026-04-10 신규: 추출된 핵심 키워드 목록을 응답에 포함
  @ApiProperty({
    description: '추출 키워드 목록',
    example: ['FastAPI', 'Redis', '협업'],
    type: [String],
  })
  extractedKeywords!: string[];

  // 2026-04-10 신규: FastAPI 분석 결과의 핵심 키워드를 그대로 전달
  @ApiProperty({
    description: '추출 키워드 목록',
    example: ['Python', 'FastAPI', 'PostgreSQL'],
    type: [String],
  })
  keywords!: string[];

  // 2026-04-10 신규: URL 기반인지 수동 입력인지 출처 타입을 표시
  @ApiPropertyOptional({
    description: '분석 출처 타입',
    example: 'JOB_POSTING_URL',
  })
  sourceType?: string | null;

  // 2026-04-10 신규: 공고 분석 처리 상태를 공개 응답에 포함
  @ApiProperty({ description: '분석 상태', example: 'COMPLETED' })
  status!: string;
}

export class JobAnalysisDetailResponseDto {
  // 2026-04-10 신규: 저장된 공고 분석 ID를 재조회 응답에 포함
  @ApiProperty({ description: '공고 분석 요청 ID', example: 'jar-001' })
  jobAnalysisRequestId!: string;

  // 2026-04-10 신규: 재조회 응답에서도 회사명을 그대로 노출
  @ApiProperty({ description: '회사명', example: 'OpenAI Korea' })
  companyName!: string;

  // 2026-04-10 신규: 재조회 응답에서도 직무명을 그대로 노출
  @ApiProperty({ description: '직무명', example: 'Backend Engineer' })
  positionName!: string;

  // 2026-04-10 신규: 재조회 응답에서도 JD 본문을 그대로 반환
  @ApiProperty({ description: '정리된 JD 본문' })
  jdText!: string;

  @ApiProperty({ description: '추출 기술 목록', type: [String] })
  extractedSkills!: string[];

  @ApiProperty({ description: '추출 키워드 목록', type: [String] })
  extractedKeywords!: string[];

  // 2026-04-10 신규: 저장된 키워드 목록을 재조회 응답에 포함
  @ApiProperty({ description: '추출 키워드 목록', type: [String] })
  keywords!: string[];

  // 2026-04-10 신규: 원본 URL이 있으면 함께 반환
  @ApiPropertyOptional({
    description: '원본 공고 URL',
    example: 'https://example.com/jobs/backend-engineer',
  })
  sourceUrl?: string | null;

  // 2026-04-10 신규: 저장된 분석 출처 타입을 재조회 응답에 포함
  @ApiPropertyOptional({
    description: '분석 출처 타입',
    example: 'JOB_POSTING_URL',
  })
  sourceType?: string | null;

  // 2026-04-10 신규: 저장된 처리 상태를 재조회 응답에 포함
  @ApiProperty({ description: '분석 상태', example: 'COMPLETED' })
  status!: string;

  // 2026-04-10 신규: 저장 시각을 재조회 응답에 포함
  @ApiProperty({ description: '생성 시각', example: '2026-04-10T12:00:00.000Z' })
  createdAt!: string;
}

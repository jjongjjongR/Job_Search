import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CoverLetterJobAnalysisDto {
  // 2026-04-10 신규: 자소서 평가 기준이 되는 회사명 입력 구조를 명확히 분리
  @ApiProperty({ description: '회사명', example: 'OpenAI Korea' })
  @IsString()
  @IsNotEmpty()
  companyName!: string;

  // 2026-04-10 신규: 자소서 평가 기준이 되는 직무명 입력 구조를 명확히 분리
  @ApiProperty({ description: '직무명', example: 'Backend Engineer' })
  @IsString()
  @IsNotEmpty()
  positionName!: string;

  // 2026-04-10 신규: JD 본문을 FastAPI에 그대로 전달하기 위한 필드 추가
  @ApiProperty({ description: 'JD 본문', example: '백엔드 서비스 개발...' })
  @IsString()
  @IsNotEmpty()
  jdText!: string;
}

export class CoverLetterDocumentsDto {
  // 2026-04-10 수정: 자소서 본문은 직접 입력 텍스트 또는 파일 추출 텍스트 중 하나를 받도록 완화
  @ApiPropertyOptional({ description: '자소서 본문', example: '안녕하세요...' })
  @IsOptional()
  @IsString()
  coverLetterText?: string;

  // 2026-04-10 신규: 파일에서 추출한 자소서 텍스트를 함께 받을 수 있게 추가
  @ApiPropertyOptional({ description: '파일에서 추출한 자소서 텍스트' })
  @IsOptional()
  @IsString()
  coverLetterFileText?: string;

  // 2026-04-10 신규: 이력서 텍스트를 선택 입력으로 정의
  @ApiPropertyOptional({ description: '이력서 텍스트' })
  @IsOptional()
  @IsString()
  resumeText?: string;

  // 2026-04-10 신규: 파일에서 추출한 이력서 텍스트를 선택 입력으로 추가
  @ApiPropertyOptional({ description: '파일에서 추출한 이력서 텍스트' })
  @IsOptional()
  @IsString()
  resumeFileText?: string;

  // 2026-04-10 신규: 포트폴리오 텍스트를 선택 입력으로 정의
  @ApiPropertyOptional({ description: '포트폴리오 텍스트' })
  @IsOptional()
  @IsString()
  portfolioText?: string;

  // 2026-04-10 신규: 파일에서 추출한 포트폴리오 텍스트를 선택 입력으로 추가
  @ApiPropertyOptional({ description: '파일에서 추출한 포트폴리오 텍스트' })
  @IsOptional()
  @IsString()
  portfolioFileText?: string;
}

export class CoverLetterFeedbackRequestDto {
  // 2026-04-10 신규: 저장된 공고 분석 결과를 재사용하기 위한 ID 입력 추가
  @ApiProperty({
    description: '공고 분석 요청 ID',
    example: 'jar-001',
  })
  @IsString()
  @IsNotEmpty()
  jobAnalysisRequestId!: string;

  // 2026-04-10 수정: 공고 분석은 요청에 직접 넣거나 ID 기준으로 재사용 가능하게 선택 입력으로 변경
  @ApiPropertyOptional({ type: CoverLetterJobAnalysisDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CoverLetterJobAnalysisDto)
  jobAnalysis?: CoverLetterJobAnalysisDto;

  // 2026-04-10 신규: 문서 텍스트 묶음을 공개 API 요청 구조에 포함
  @ApiProperty({ type: CoverLetterDocumentsDto })
  @ValidateNested()
  @Type(() => CoverLetterDocumentsDto)
  documents!: CoverLetterDocumentsDto;
}

export class CoverLetterFeedbackResponseDto {
  // 2026-04-10 신규: 현재 단계에서도 리포트 식별자를 응답에 포함
  @ApiProperty({ description: '리포트 ID', example: 'clr-001' })
  @IsString()
  reportId!: string;

  // 2026-04-10 신규: 응답에서 기준 회사명을 바로 보여주기 위한 필드 추가
  @ApiProperty({ description: '회사명', example: 'OpenAI Korea' })
  @IsString()
  companyName!: string;

  // 2026-04-10 신규: 응답에서 기준 직무명을 바로 보여주기 위한 필드 추가
  @ApiProperty({ description: '직무명', example: 'Backend Engineer' })
  @IsString()
  positionName!: string;

  // 2026-04-10 신규: 종합 점수를 Swagger 응답에 노출
  @ApiProperty({ description: '종합 점수', example: 84 })
  @IsInt()
  totalScore!: number;

  // 2026-04-10 신규: 전체 요약을 응답에 포함
  @ApiProperty({ description: '전체 요약' })
  @IsString()
  summary!: string;

  // 2026-04-10 신규: 강점 배열을 응답에 포함
  @ApiProperty({ description: '강점 목록', type: [String] })
  @IsArray()
  strengths!: string[];

  // 2026-04-10 신규: 보완점 배열을 응답에 포함
  @ApiProperty({ description: '보완점 목록', type: [String] })
  @IsArray()
  weaknesses!: string[];

  // 2026-04-10 신규: 수정 방향 배열을 응답에 포함
  @ApiProperty({ description: '수정 방향 목록', type: [String] })
  @IsArray()
  revisionDirections!: string[];

  // 2026-04-10 신규: 문서 기준 next actions 명칭도 함께 응답
  @ApiProperty({ description: '다음 액션 목록', type: [String] })
  @IsArray()
  nextActions!: string[];
}

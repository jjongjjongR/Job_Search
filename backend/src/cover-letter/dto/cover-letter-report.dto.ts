import { ApiProperty } from '@nestjs/swagger';

export class CoverLetterReportSummaryDto {
  @ApiProperty({ example: 'clr-001' })
  reportId!: string;

  @ApiProperty({ example: 'OpenAI Korea' })
  companyName!: string;

  @ApiProperty({ example: 'Backend Engineer' })
  positionName!: string;

  @ApiProperty({ example: 84 })
  totalScore!: number;

  @ApiProperty({ example: '2026-04-10T00:00:00.000Z' })
  createdAt!: string;
}

export class CoverLetterReportDetailDto extends CoverLetterReportSummaryDto {
  @ApiProperty({
    type: [Object],
    example: [
      {
        questionNumber: 1,
        title: '[문항 1] 지원 직무 분야의 전문성을 키우기 위해 노력한 경험',
        score: 78,
        feedback: 'JD 키워드 연결이 어느 정도 보입니다',
      },
    ],
  })
  questionScores!: {
    questionNumber: number;
    title: string;
    score: number;
    feedback: string;
  }[];

  @ApiProperty({ example: 76 })
  jdAlignmentScore!: number;

  @ApiProperty({ example: 73 })
  jobFitScore!: number;

  @ApiProperty({ example: 0.82 })
  confidence!: number;

  @ApiProperty({ type: [String] })
  verifiedJdKeywords!: string[];

  @ApiProperty({ type: [Object] })
  rubricScores!: {
    category: string;
    score: number;
    maxScore: number;
    evidenceText: string;
    evidenceSource: string;
    verified: boolean;
  }[];

  @ApiProperty({ type: [Object] })
  ragEvidence!: {
    source: string;
    text: string;
    score: number;
  }[];

  @ApiProperty()
  summary!: string;

  @ApiProperty()
  revisedDraft!: string;

  @ApiProperty({ type: [String] })
  strengths!: string[];

  @ApiProperty({ type: [String] })
  weaknesses!: string[];

  @ApiProperty({ type: [String] })
  revisionDirections!: string[];

  @ApiProperty({ type: [String] })
  nextActions!: string[];
}

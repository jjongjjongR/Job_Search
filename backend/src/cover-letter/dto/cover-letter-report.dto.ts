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
  @ApiProperty()
  summary!: string;

  @ApiProperty({ type: [String] })
  strengths!: string[];

  @ApiProperty({ type: [String] })
  weaknesses!: string[];

  @ApiProperty({ type: [String] })
  revisionDirections!: string[];

  @ApiProperty({ type: [String] })
  nextActions!: string[];
}

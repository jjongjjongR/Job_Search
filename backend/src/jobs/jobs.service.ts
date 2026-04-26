import { randomUUID } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiClientService } from '../ai-client/ai-client.service';
import {
  AnalyzeJobRequestDto,
  JobAnalysisDetailResponseDto,
  AnalyzeJobResponseDto,
} from './dto/analyze-job.dto';
import { JobAnalysisRequest } from './entities/job-analysis-request.entity';
import { JobAnalysisRequestStatus } from '../ai/entities/ai.enums';

export interface JobAnalysisSnapshot {
  id: string;
  companyName: string;
  positionName: string;
  jdText: string;
  extractedSkills: string[];
  extractedKeywords: string[];
  keywords: string[];
  sourceUrl?: string | null;
  sourceType?: string | null;
  status?: string;
  createdAt?: string;
}

@Injectable()
export class JobsService {
  constructor(
    private readonly aiClientService: AiClientService,
    @InjectRepository(JobAnalysisRequest)
    private readonly jobAnalysisRepository: Repository<JobAnalysisRequest>,
  ) {}

  // 2026-04-10 신규: 공개 공고 분석 요청을 FastAPI 호출 결과와 내부 ID로 정리
  async analyze(
    userId: string,
    payload: AnalyzeJobRequestDto,
  ): Promise<AnalyzeJobResponseDto> {
    const normalizedPayload = {
      ...payload,
      jobUrl: payload.jobUrl ?? payload.jobPostingUrl,
    };
    const response = await this.aiClientService.analyzeJob(normalizedPayload);
    const jobAnalysisRequestId = this.createJobAnalysisRequestId();

    // 2026-04-10 수정: 공고 분석 결과를 메모리가 아니라 DB에 저장
    await this.jobAnalysisRepository.save(
      this.jobAnalysisRepository.create({
        id: jobAnalysisRequestId,
        userId,
        sourceUrl: normalizedPayload.jobUrl ?? null,
        companyName: response.companyName,
        jobTitle: response.positionName,
        jdText: response.jdText,
        keywordsJson: response.extractedKeywords ?? response.keywords,
        skillsJson: response.extractedSkills ?? [],
        sourceType: response.sourceType ?? null,
        status: JobAnalysisRequestStatus.COMPLETED,
      }),
    );

    return {
      jobAnalysisRequestId,
      companyName: response.companyName,
      positionName: response.positionName,
      jdText: response.jdText,
      extractedSkills: response.extractedSkills ?? [],
      extractedKeywords: response.extractedKeywords ?? response.keywords,
      keywords: response.keywords,
      sourceType: response.sourceType,
      // 2026-04-10 신규: 공고 분석 저장 성공 상태를 공개 응답에 포함
      status: JobAnalysisRequestStatus.COMPLETED,
    };
  }

  // 2026-04-10 수정: 다음 단계 API와 재조회 API가 함께 사용할 수 있게 저장 정보를 확장 조회
  async findAnalysisById(id: string): Promise<JobAnalysisSnapshot | undefined> {
    const jobAnalysis = await this.jobAnalysisRepository.findOneBy({ id });
    if (!jobAnalysis) {
      return undefined;
    }

    return {
      id: jobAnalysis.id,
      companyName: jobAnalysis.companyName,
      positionName: jobAnalysis.jobTitle,
      jdText: jobAnalysis.jdText,
      extractedSkills: jobAnalysis.skillsJson,
      extractedKeywords: jobAnalysis.keywordsJson,
      keywords: jobAnalysis.keywordsJson,
      sourceUrl: jobAnalysis.sourceUrl,
      sourceType: jobAnalysis.sourceType,
      status: jobAnalysis.status,
      createdAt: jobAnalysis.createdAt.toISOString(),
    };
  }

  // 2026-04-10 신규: 저장된 공고 분석 결과를 공개 API로 재조회
  async getAnalysisById(
    userId: string,
    id: string,
  ): Promise<JobAnalysisDetailResponseDto> {
    const jobAnalysis = await this.jobAnalysisRepository.findOneBy({ id, userId });
    if (!jobAnalysis) {
      // 2026-04-10 수정: 공고 분석 재조회 실패를 NestJS 표준 404 예외로 정리
      throw new NotFoundException('공고 분석 결과를 찾을 수 없습니다.');
    }

    return {
      jobAnalysisRequestId: jobAnalysis.id,
      companyName: jobAnalysis.companyName,
      positionName: jobAnalysis.jobTitle,
      jdText: jobAnalysis.jdText,
      extractedSkills: jobAnalysis.skillsJson,
      extractedKeywords: jobAnalysis.keywordsJson,
      keywords: jobAnalysis.keywordsJson,
      sourceUrl: jobAnalysis.sourceUrl,
      sourceType: jobAnalysis.sourceType,
      status: jobAnalysis.status,
      createdAt: jobAnalysis.createdAt.toISOString(),
    };
  }

  // 2026-04-10 신규: 사람이 읽기 쉬운 공고 분석 ID 형식 유지
  private createJobAnalysisRequestId(): string {
    return `jar-${randomUUID()}`;
  }
}

import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiClientService } from '../ai-client/ai-client.service';
import {
  CoverLetterFeedbackRequestDto,
  CoverLetterFeedbackResponseDto,
} from './dto/cover-letter-feedback.dto';
import { CoverLetterReport } from './entities/cover-letter-report.entity';
import { CoverLetterReportDetailDto, CoverLetterReportSummaryDto } from './dto/cover-letter-report.dto';
import { JobsService } from '../jobs/jobs.service';
import { FilesService } from '../files/files.service';
import {
  extractTextFromStoredFile,
  extractTextFromUploadedFile,
} from './utils/document-text-extractor';

interface CoverLetterUploadedFiles {
  coverLetterFile?: Express.Multer.File;
  resumeFile?: Express.Multer.File;
  portfolioFile?: Express.Multer.File;
}

@Injectable()
export class CoverLetterService {
  constructor(
    private readonly aiClientService: AiClientService,
    private readonly jobsService: JobsService,
    private readonly filesService: FilesService,
    @InjectRepository(CoverLetterReport)
    private readonly coverLetterReportRepository: Repository<CoverLetterReport>,
  ) {}

  // 2026-04-10 신규: 공개 자소서 피드백 요청을 FastAPI 호출 결과로 변환
  async createFeedback(
    userId: string,
    payload: CoverLetterFeedbackRequestDto,
    uploadedFiles?: CoverLetterUploadedFiles,
  ): Promise<CoverLetterFeedbackResponseDto> {
    const resolvedJobAnalysis =
      payload.jobAnalysis ?? (await this.resolveJobAnalysis(payload.jobAnalysisRequestId));
    const normalizedDocuments = await this.normalizeDocuments(
      payload,
      uploadedFiles,
    );
    const response = await this.aiClientService.createCoverLetterFeedback({
      userId,
      jobAnalysis: resolvedJobAnalysis,
      documents: normalizedDocuments,
    });

    const reportId = this.createReportId();
    const report = this.coverLetterReportRepository.create({
      id: reportId,
      userId,
      jobAnalysisRequestId: payload.jobAnalysisRequestId,
      companyName: resolvedJobAnalysis.companyName,
      jobTitle: resolvedJobAnalysis.positionName,
      totalScore: response.totalScore,
      jdAlignmentScore: response.jdAlignmentScore,
      jobFitScore: response.jobFitScore,
      confidence: response.confidence,
      verifiedJdKeywordsJson: response.verifiedJdKeywords,
      summaryText: response.summary,
      revisedDraftText: response.revisedDraft,
      questionScoresJson: response.questionScores,
      rubricScoresJson: response.rubricScores,
      ragEvidenceJson: response.ragEvidence,
      strengthsJson: response.strengths,
      weaknessesJson: response.weaknesses,
      guideJson: response.revisionDirections,
    });
    await this.coverLetterReportRepository.save(report);

    return {
      reportId,
      companyName: resolvedJobAnalysis.companyName,
      positionName: resolvedJobAnalysis.positionName,
      totalScore: response.totalScore,
      jdAlignmentScore: response.jdAlignmentScore,
      jobFitScore: response.jobFitScore,
      confidence: response.confidence,
      verifiedJdKeywords: response.verifiedJdKeywords,
      rubricScores: response.rubricScores,
      ragEvidence: response.ragEvidence,
      summary: response.summary,
      revisedDraft: response.revisedDraft,
      questionScores: response.questionScores,
      strengths: response.strengths,
      weaknesses: response.weaknesses,
      revisionDirections: response.revisionDirections,
      nextActions: response.nextActions ?? response.revisionDirections,
    };
  }

  // 2026-04-10 신규: 로그인 사용자의 자소서 리포트 목록 조회
  async listReports(userId: string): Promise<CoverLetterReportSummaryDto[]> {
    const reports = await this.coverLetterReportRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    return reports.map((report) => ({
      reportId: report.id,
      companyName: report.companyName,
      positionName: report.jobTitle,
      totalScore: report.totalScore,
      createdAt: report.createdAt.toISOString(),
    }));
  }

  // 2026-04-10 신규: 로그인 사용자의 자소서 리포트 단건 조회
  async getReport(
    userId: string,
    reportId: string,
  ): Promise<CoverLetterReportDetailDto> {
    const report = await this.coverLetterReportRepository.findOneBy({
      id: reportId,
      userId,
    });

    if (!report) {
      throw new NotFoundException('자소서 리포트를 찾을 수 없습니다.');
    }

    return {
      reportId: report.id,
      companyName: report.companyName,
      positionName: report.jobTitle,
      totalScore: report.totalScore,
      jdAlignmentScore: report.jdAlignmentScore ?? 0,
      jobFitScore: report.jobFitScore ?? 0,
      confidence: report.confidence ?? 0,
      verifiedJdKeywords: report.verifiedJdKeywordsJson ?? [],
      rubricScores: report.rubricScoresJson ?? [],
      ragEvidence: report.ragEvidenceJson ?? [],
      summary: report.summaryText,
      revisedDraft: report.revisedDraftText ?? '',
      questionScores: report.questionScoresJson ?? [],
      strengths: report.strengthsJson,
      weaknesses: report.weaknessesJson,
      revisionDirections: report.guideJson,
      nextActions: report.guideJson,
      createdAt: report.createdAt.toISOString(),
    };
  }

  // 2026-04-15 신규: 마이페이지에서 저장된 자소서 리포트를 삭제
  async deleteReport(userId: string, reportId: string): Promise<void> {
    const report = await this.coverLetterReportRepository.findOneBy({
      id: reportId,
      userId,
    });

    if (!report) {
      throw new NotFoundException('자소서 리포트를 찾을 수 없습니다.');
    }

    await this.coverLetterReportRepository.remove(report);
  }

  // 2026-04-10 신규: 공고 분석 ID로 실제 기준 정보를 채우는 헬퍼
  async resolveJobAnalysis(jobAnalysisRequestId: string) {
    const jobAnalysis = await this.jobsService.findAnalysisById(jobAnalysisRequestId);
    if (!jobAnalysis) {
      throw new NotFoundException('공고 분석 결과를 찾을 수 없습니다.');
    }

    return {
      companyName: jobAnalysis.companyName,
      positionName: jobAnalysis.positionName,
      jdText: jobAnalysis.jdText,
    };
  }

  // 2026-04-10 신규: 직접 입력 텍스트와 파일 추출 텍스트 중 실제 평가에 사용할 값을 정리
  private async normalizeDocuments(
    payload: CoverLetterFeedbackRequestDto,
    uploadedFiles?: CoverLetterUploadedFiles,
  ): Promise<{
    coverLetterText?: string;
    coverLetterFileText?: string;
    resumeText?: string;
    resumeFileText?: string;
      portfolioText?: string;
      portfolioFileText?: string;
  }> {
    const safeDocuments = payload.documents ?? {};
    const coverLetterDocumentText =
      safeDocuments.coverLetterText?.trim() ||
      (await this.resolveDocumentTextById(payload.coverLetterDocumentId));
    const resumeDocumentText =
      safeDocuments.resumeText?.trim() || (await this.resolveDocumentTextById(payload.resumeDocumentId));
    const portfolioDocumentText =
      safeDocuments.portfolioText?.trim() ||
      (await this.resolveDocumentTextById(payload.portfolioDocumentId));
    const coverLetterFileText =
      safeDocuments.coverLetterFileText?.trim() ||
      (uploadedFiles?.coverLetterFile
        ? await extractTextFromUploadedFile(uploadedFiles.coverLetterFile)
        : undefined);
    const resumeFileText =
      safeDocuments.resumeFileText?.trim() ||
      (uploadedFiles?.resumeFile
        ? await extractTextFromUploadedFile(uploadedFiles.resumeFile)
        : undefined);
    const portfolioFileText =
      safeDocuments.portfolioFileText?.trim() ||
      (uploadedFiles?.portfolioFile
        ? await extractTextFromUploadedFile(uploadedFiles.portfolioFile)
        : undefined);

    const coverLetterText = (
      coverLetterDocumentText ?? coverLetterFileText ?? ''
    ).trim();
    if (!coverLetterText) {
      throw new BadRequestException(
        '자소서 본문 또는 파일 추출 텍스트가 필요합니다.',
      );
    }

    return {
      coverLetterText: coverLetterDocumentText || undefined,
      coverLetterFileText: coverLetterFileText || undefined,
      resumeText: resumeDocumentText || undefined,
      resumeFileText: resumeFileText || undefined,
      portfolioText: portfolioDocumentText || undefined,
      portfolioFileText: portfolioFileText || undefined,
    };
  }

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

  // 2026-04-10 신규: 사람이 읽기 쉬운 자소서 리포트 ID 형식 유지
  private createReportId(): string {
    return `clr-${randomUUID()}`;
  }
}

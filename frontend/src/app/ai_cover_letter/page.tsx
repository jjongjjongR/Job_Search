'use client';

import { useEffect, useState } from 'react';
import { FeatureShell } from '@/components/feature-shell';
import { LoginRequiredCard } from '@/components/login-required-card';
import { apiRequest, ApiError } from '@/lib/api';
import { getAccessToken, getStoredUser, type AuthUser } from '@/lib/auth';

type JobAnalysisResponse = {
  jobAnalysisRequestId: string;
  companyName: string;
  positionName: string;
  jdText: string;
  extractedSkills?: string[];
  extractedKeywords?: string[];
  keywords: string[];
  sourceType?: string | null;
  status: string;
};

type CoverLetterFeedbackResponse = {
  reportId: string;
  companyName: string;
  positionName: string;
  totalScore: number;
  jdAlignmentScore: number;
  jobFitScore: number;
  confidence: number;
  verifiedJdKeywords: string[];
  rubricScores: CoverLetterRubricScore[];
  ragEvidence: CoverLetterRagEvidence[];
  summary: string;
  revisedDraft: string;
  questionScores: {
    questionNumber: number;
    title: string;
    score: number;
    feedback: string;
  }[];
  strengths: string[];
  weaknesses: string[];
  revisionDirections: string[];
  nextActions?: string[];
};

type CoverLetterRubricScore = {
  category: string;
  score: number;
  maxScore: number;
  evidenceText: string;
  evidenceSource: string;
  verified: boolean;
};

type CoverLetterRagEvidence = {
  source: string;
  text: string;
  score: number;
};

type CoverLetterReportSummary = {
  reportId: string;
  companyName: string;
  positionName: string;
  totalScore: number;
  createdAt: string;
};

type CoverLetterReportDetail = CoverLetterReportSummary & {
  jdAlignmentScore: number;
  jobFitScore: number;
  confidence: number;
  verifiedJdKeywords: string[];
  rubricScores: CoverLetterRubricScore[];
  ragEvidence: CoverLetterRagEvidence[];
  summary: string;
  revisedDraft: string;
  questionScores: {
    questionNumber: number;
    title: string;
    score: number;
    feedback: string;
  }[];
  strengths: string[];
  weaknesses: string[];
  revisionDirections: string[];
  nextActions?: string[];
};

export default function AICoverLetterPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [jobForm, setJobForm] = useState({
    jobUrl: '',
    manualCompanyName: '',
    manualJobTitle: '',
    manualJdText: '',
  });
  const [analysisError, setAnalysisError] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [jobAnalysis, setJobAnalysis] = useState<JobAnalysisResponse | null>(null);

  const [inputMode, setInputMode] = useState<'text' | 'file'>('text');
  const [feedbackForm, setFeedbackForm] = useState({
    jobAnalysisRequestId: '',
    coverLetterText: '',
    resumeText: '',
    portfolioText: '',
  });
  const [files, setFiles] = useState<{
    coverLetterFile: File | null;
    resumeFile: File | null;
    portfolioFile: File | null;
  }>({
    coverLetterFile: null,
    resumeFile: null,
    portfolioFile: null,
  });
  const [feedbackError, setFeedbackError] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [latestReport, setLatestReport] =
    useState<CoverLetterFeedbackResponse | CoverLetterReportDetail | null>(null);

  useEffect(() => {
    const currentUser = getStoredUser();
    const accessToken = getAccessToken();

    // 2026-04-15 수정: 저장된 user만 있고 토큰이 없는 오래된 로그인 상태에서는 보호 API를 호출하지 않음
    if (!currentUser || !accessToken) {
      setUser(null);
      return;
    }

    setUser(currentUser);
  }, []);

  const handleAnalyze = async () => {
    // 2026-04-15 신규: 버튼 클릭 시점에도 토큰 존재 여부를 다시 확인해 만료된 로그인으로 API를 호출하지 않음
    if (!getAccessToken()) {
      setUser(null);
      setAnalysisError('로그인이 만료되었습니다. 다시 로그인해 주세요.');
      return;
    }

    setAnalysisError('');
    setIsAnalyzing(true);

    try {
      const created = await apiRequest<JobAnalysisResponse>('/jobs/analyze', {
        method: 'POST',
        body: JSON.stringify(jobForm),
      });
      setJobAnalysis(created);
      setFeedbackForm((current) => ({
        ...current,
        jobAnalysisRequestId: created.jobAnalysisRequestId,
      }));
    } catch (error) {
      setAnalysisError(
        error instanceof ApiError && error.status === 401
          ? '로그인이 만료되었습니다. 다시 로그인해 주세요.'
          : error instanceof ApiError
            ? error.message
            : '공고 분석에 실패했습니다.',
      );
      // 2026-04-15 신규: 401 발생 시 화면도 즉시 비로그인 상태로 맞춰 로그인 안내를 보여줌
      if (error instanceof ApiError && error.status === 401) {
        setUser(null);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmitFeedback = async () => {
    // 2026-04-15 신규: 자소서 피드백 생성 직전에도 토큰을 다시 확인해 Unauthorized 노출을 줄임
    if (!getAccessToken()) {
      setUser(null);
      setFeedbackError('로그인이 만료되었습니다. 다시 로그인해 주세요.');
      return;
    }

    setFeedbackError('');
    setIsSubmittingFeedback(true);

    try {
      let created: CoverLetterFeedbackResponse;

      if (inputMode === 'file') {
        const formData = new FormData();
        formData.append('jobAnalysisRequestId', feedbackForm.jobAnalysisRequestId);
        if (files.coverLetterFile) {
          formData.append('coverLetterFile', files.coverLetterFile);
        }
        if (files.resumeFile) {
          formData.append('resumeFile', files.resumeFile);
        }
        if (files.portfolioFile) {
          formData.append('portfolioFile', files.portfolioFile);
        }

        created = await apiRequest<CoverLetterFeedbackResponse>(
          '/ai/cover-letter/feedback',
          {
            method: 'POST',
            body: formData,
          },
        );
      } else {
        created = await apiRequest<CoverLetterFeedbackResponse>(
          '/ai/cover-letter/feedback',
          {
            method: 'POST',
            body: JSON.stringify({
              jobAnalysisRequestId: feedbackForm.jobAnalysisRequestId,
              documents: {
                coverLetterText: feedbackForm.coverLetterText,
                resumeText: feedbackForm.resumeText,
                portfolioText: feedbackForm.portfolioText,
              },
            }),
          },
        );
      }

      const detail = await apiRequest<CoverLetterReportDetail>(
        `/ai/cover-letter/reports/${created.reportId}`,
      );
      setLatestReport(detail);
    } catch (error) {
      setFeedbackError(
        error instanceof ApiError && error.status === 401
          ? '로그인이 만료되었습니다. 다시 로그인해 주세요.'
          : error instanceof ApiError
            ? error.message
            : '자소서 피드백 생성에 실패했습니다.',
      );
      // 2026-04-15 신규: 인증 실패 시 저장된 로그인 표시도 바로 정리함
      if (error instanceof ApiError && error.status === 401) {
        setUser(null);
      }
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  return (
    <FeatureShell
      eyebrow="AI Cover Letter"
      title="자소서 AI 평가와 수정 초안을 생성합니다"
      description="공고 분석을 먼저 만든 뒤, 텍스트 또는 파일 입력으로 자소서 피드백과 수정 초안을 생성합니다. 저장된 리포트 목록은 마이페이지에서 다시 확인할 수 있습니다."
    >
      {!user ? (
        <LoginRequiredCard
          title="자소서 AI는 로그인한 회원만 사용할 수 있습니다"
          description="공고 분석 저장, 자소서 리포트 생성, 지난 결과 재조회까지 모두 회원 계정 기준으로 동작합니다."
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <section className="rounded-[28px] bg-white p-8 shadow-[0_18px_50px_rgba(16,36,61,0.07)]">
              <h2 className="text-2xl font-bold">1. 공고 분석 만들기</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                URL과 수동 입력을 함께 넣을 수 있습니다. URL 분석이 애매하면 수동 입력 값이 기준 데이터가 됩니다.
              </p>

              <div className="mt-6 grid gap-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">공고 URL</span>
                  <input
                    value={jobForm.jobUrl}
                    onChange={(event) =>
                      setJobForm((current) => ({
                        ...current,
                        jobUrl: event.target.value,
                      }))
                    }
                    placeholder="https://careers.example.com/backend-engineer"
                    className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--card-soft)] px-4 py-3"
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold">회사명</span>
                    <input
                      value={jobForm.manualCompanyName}
                      onChange={(event) =>
                        setJobForm((current) => ({
                          ...current,
                          manualCompanyName: event.target.value,
                        }))
                      }
                      placeholder="온세상이취업"
                      className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--card-soft)] px-4 py-3"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold">직무명</span>
                    <input
                      value={jobForm.manualJobTitle}
                      onChange={(event) =>
                        setJobForm((current) => ({
                          ...current,
                          manualJobTitle: event.target.value,
                        }))
                      }
                      placeholder="백엔드 개발자"
                      className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--card-soft)] px-4 py-3"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">JD 본문</span>
                  <textarea
                    value={jobForm.manualJdText}
                    onChange={(event) =>
                      setJobForm((current) => ({
                        ...current,
                        manualJdText: event.target.value,
                      }))
                    }
                    rows={5}
                    placeholder="FastAPI, PostgreSQL, Redis 기반 백엔드 서비스 개발..."
                    className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--card-soft)] px-4 py-3"
                  />
                </label>

                {analysisError ? (
                  <p className="text-sm text-red-600">{analysisError}</p>
                ) : null}

                <button
                  type="button"
                  onClick={() => void handleAnalyze()}
                  disabled={isAnalyzing}
                  className="rounded-full bg-[var(--accent)] px-5 py-3 font-semibold text-white shadow-[0_12px_28px_rgba(30,111,217,0.28)] disabled:opacity-60"
                >
                  {isAnalyzing ? '공고 분석 중...' : '공고 분석 생성'}
                </button>
              </div>

              {jobAnalysis ? (
                <div className="mt-6 rounded-[24px] border border-[var(--border-soft)] bg-[var(--card-soft)] p-5">
                  <p className="text-sm font-semibold text-[var(--accent)]">
                    분석 ID: {jobAnalysis.jobAnalysisRequestId}
                  </p>
                  <h3 className="mt-3 text-lg font-bold">
                    {jobAnalysis.companyName} / {jobAnalysis.positionName}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                    {jobAnalysis.jdText}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(jobAnalysis.extractedSkills ?? []).map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-[var(--accent)]"
                      >
                        기술 {skill}
                      </span>
                    ))}
                    {(jobAnalysis.extractedKeywords ?? jobAnalysis.keywords).map(
                      (keyword) => (
                        <span
                          key={keyword}
                          className="rounded-full border border-[var(--border-soft)] bg-white px-3 py-2 text-xs font-semibold"
                        >
                          {keyword}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              ) : null}
            </section>

            <section className="rounded-[28px] bg-white p-8 shadow-[0_18px_50px_rgba(16,36,61,0.07)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold">2. 자소서 피드백 생성</h2>
                  <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                    최근에 만든 공고 분석 ID를 그대로 재사용하거나, 이미 저장된 ID를 직접 넣을 수 있습니다.
                  </p>
                </div>
                <div className="flex gap-2 rounded-full bg-[var(--card-soft)] p-1">
                  {[
                    { value: 'text', label: '텍스트 입력' },
                    { value: 'file', label: '파일 업로드' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setInputMode(option.value as 'text' | 'file')
                      }
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${
                        inputMode === option.value
                          ? 'bg-[var(--accent)] text-white'
                          : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">
                    공고 분석 ID
                  </span>
                  <input
                    value={feedbackForm.jobAnalysisRequestId}
                    onChange={(event) =>
                      setFeedbackForm((current) => ({
                        ...current,
                        jobAnalysisRequestId: event.target.value,
                      }))
                    }
                    placeholder="jar-..."
                    className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--card-soft)] px-4 py-3"
                  />
                </label>

                {inputMode === 'text' ? (
                  <>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold">
                        자소서 본문
                      </span>
                      <textarea
                        value={feedbackForm.coverLetterText}
                        onChange={(event) =>
                          setFeedbackForm((current) => ({
                            ...current,
                            coverLetterText: event.target.value,
                          }))
                        }
                        rows={6}
                        className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--card-soft)] px-4 py-3"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold">
                        이력서 텍스트
                      </span>
                      <textarea
                        value={feedbackForm.resumeText}
                        onChange={(event) =>
                          setFeedbackForm((current) => ({
                            ...current,
                            resumeText: event.target.value,
                          }))
                        }
                        rows={4}
                        className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--card-soft)] px-4 py-3"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold">
                        포트폴리오 텍스트
                      </span>
                      <textarea
                        value={feedbackForm.portfolioText}
                        onChange={(event) =>
                          setFeedbackForm((current) => ({
                            ...current,
                            portfolioText: event.target.value,
                          }))
                        }
                        rows={4}
                        className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--card-soft)] px-4 py-3"
                      />
                    </label>
                  </>
                ) : (
                  <div className="grid gap-4 md:grid-cols-3">
                    <FileInput
                      label="자소서 파일"
                      onChange={(file) =>
                        setFiles((current) => ({
                          ...current,
                          coverLetterFile: file,
                        }))
                      }
                    />
                    <FileInput
                      label="이력서 파일"
                      onChange={(file) =>
                        setFiles((current) => ({
                          ...current,
                          resumeFile: file,
                        }))
                      }
                    />
                    <FileInput
                      label="포트폴리오 파일"
                      onChange={(file) =>
                        setFiles((current) => ({
                          ...current,
                          portfolioFile: file,
                        }))
                      }
                    />
                  </div>
                )}

                {feedbackError ? (
                  <p className="text-sm text-red-600">{feedbackError}</p>
                ) : null}

                <button
                  type="button"
                  onClick={() => void handleSubmitFeedback()}
                  disabled={isSubmittingFeedback}
                  className="rounded-full bg-[var(--card-strong)] px-5 py-3 font-semibold text-white shadow-[0_12px_28px_rgba(16,36,61,0.18)] disabled:opacity-60"
                >
                  {isSubmittingFeedback ? '피드백 생성 중...' : '자소서 피드백 생성'}
                </button>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-[28px] bg-white p-8 shadow-[0_18px_50px_rgba(16,36,61,0.07)]">
              <h2 className="text-2xl font-bold">분석 결과</h2>
              {!latestReport ? (
                <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">
                  새 분석을 생성하면 결과가 여기에 표시됩니다. 저장된 리포트는 마이페이지에서 확인할 수 있습니다.
                </p>
              ) : (
                <div className="mt-5 space-y-5">
                  <div className="rounded-[24px] bg-[var(--card-soft)] p-5">
                    <p className="text-sm font-semibold text-[var(--accent)]">
                      {latestReport.companyName} / {latestReport.positionName}
                    </p>
                    <p className="mt-3 text-3xl font-bold">
                      {latestReport.totalScore}점
                    </p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <ScoreCard
                        label="JD 반영도"
                        value={latestReport.jdAlignmentScore}
                      />
                      <ScoreCard
                        label="직무 적합도"
                        value={latestReport.jobFitScore}
                      />
                    </div>
                    <TrustSummary
                      confidence={latestReport.confidence}
                      keywords={latestReport.verifiedJdKeywords}
                    />
                    <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                      {latestReport.summary}
                    </p>
                  </div>

                  <QuestionScoreList items={latestReport.questionScores} />
                  <RubricScoreList items={latestReport.rubricScores} />
                  <RagEvidenceList items={latestReport.ragEvidence} />
                  <ResultList title="강점" items={latestReport.strengths} />
                  <ResultList title="보완점" items={latestReport.weaknesses} />
                  <ResultList
                    title="다음 액션"
                    items={
                      latestReport.nextActions ?? latestReport.revisionDirections
                    }
                  />
                  <DraftCard draft={latestReport.revisedDraft} />
                </div>
              )}
            </section>

            <div className="rounded-[28px] border border-[var(--border-soft)] bg-white p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
                흐름 요약
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--text-muted)]">
                <li>프론트는 NestJS 공개 API만 호출합니다.</li>
                <li>공고 분석 결과는 `jobAnalysisRequestId`로 저장됩니다.</li>
                <li>자소서 피드백은 텍스트 입력과 파일 업로드 둘 다 지원합니다.</li>
                <li>생성된 리포트 목록과 상세 조회는 마이페이지에서 확인할 수 있습니다.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </FeatureShell>
  );
}

function FileInput({
  label,
  onChange,
}: {
  label: string;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className="block rounded-[24px] border border-[var(--border-soft)] bg-[var(--card-soft)] p-4">
      <span className="mb-3 block text-sm font-semibold">{label}</span>
      <input
        type="file"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        className="w-full text-sm"
      />
    </label>
  );
}

function ResultList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-lg font-bold">{title}</h3>
      <div className="mt-3 space-y-3">
        {items.map((item) => (
          <div
            key={item}
            className="rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-4 text-sm leading-6 text-[var(--text-muted)]"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold">{value}점</p>
    </div>
  );
}

function QuestionScoreList({
  items,
}: {
  items: {
    questionNumber: number;
    title: string;
    score: number;
    feedback: string;
  }[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="text-lg font-bold">문항별 점수</h3>
      <div className="mt-3 space-y-3">
        {items.map((item) => (
          <div
            key={`${item.questionNumber}-${item.title}`}
            className="rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                  {item.feedback}
                </p>
              </div>
              <p className="shrink-0 text-lg font-bold text-[var(--accent)]">
                {item.score}점
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrustSummary({
  confidence,
  keywords,
}: {
  confidence?: number;
  keywords?: string[];
}) {
  return (
    <div className="mt-4 rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-4">
      <p className="text-sm font-semibold">근거 신뢰도</p>
      <p className="mt-2 text-2xl font-bold text-[var(--accent)]">
        {Math.round((confidence ?? 0) * 100)}%
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(keywords ?? []).slice(0, 8).map((keyword) => (
          <span
            key={keyword}
            className="rounded-full border border-[var(--border-soft)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)]"
          >
            {keyword}
          </span>
        ))}
      </div>
    </div>
  );
}

function RubricScoreList({ items }: { items?: CoverLetterRubricScore[] }) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="text-lg font-bold">항목별 평가 기준</h3>
      <div className="mt-3 space-y-3">
        {items.map((item) => (
          <div
            key={item.category}
            className="rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">
                  {item.category} · {item.evidenceSource}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                  {item.evidenceText}
                </p>
                <p className="mt-2 text-xs font-semibold text-[var(--accent)]">
                  {item.verified ? '입력 문서 근거 확인됨' : '근거 부족으로 감점됨'}
                </p>
              </div>
              <p className="shrink-0 text-lg font-bold text-[var(--accent)]">
                {item.score}/{item.maxScore}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RagEvidenceList({ items }: { items?: CoverLetterRagEvidence[] }) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="text-lg font-bold">RAG 검색 근거</h3>
      <div className="mt-3 space-y-3">
        {items.slice(0, 5).map((item, index) => (
          <div
            key={`${item.source}-${index}`}
            className="rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-4 text-sm leading-6 text-[var(--text-muted)]"
          >
            <p className="font-semibold text-[var(--text)]">
              {item.source} · 유사도 {item.score}
            </p>
            <p className="mt-2">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DraftCard({ draft }: { draft: string }) {
  return (
    <div>
      <h3 className="text-lg font-bold">자소서 수정 초안</h3>
      <div className="mt-3 rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-4">
        <pre className="whitespace-pre-wrap text-sm leading-7 text-[var(--text-muted)]">
          {draft}
        </pre>
      </div>
    </div>
  );
}

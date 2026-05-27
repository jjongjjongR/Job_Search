'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import { FeatureShell } from '@/components/feature-shell';
import { LoginRequiredCard } from '@/components/login-required-card';
import { ApiError, apiRequest } from '@/lib/api';
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

type CoverLetterFeedbackResponse = CoverLetterReportDetail;

type CoverLetterReportDetail = {
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

type MainTab = 'create' | 'result';
type ResultTab = 'summary' | 'questions' | 'draft' | 'details';

export default function AICoverLetterPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mainTab, setMainTab] = useState<MainTab>('create');
  const [resultTab, setResultTab] = useState<ResultTab>('summary');
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
  const [latestReport, setLatestReport] = useState<CoverLetterReportDetail | null>(
    null,
  );

  useEffect(() => {
    const currentUser = getStoredUser();
    const accessToken = getAccessToken();

    if (!currentUser || !accessToken) {
      setUser(null);
      return;
    }

    setUser(currentUser);
  }, []);

  const handleAnalyze = async () => {
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
      if (error instanceof ApiError && error.status === 401) {
        setUser(null);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmitFeedback = async () => {
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
      setMainTab('result');
      setResultTab('summary');
    } catch (error) {
      setFeedbackError(
        error instanceof ApiError && error.status === 401
          ? '로그인이 만료되었습니다. 다시 로그인해 주세요.'
          : error instanceof ApiError
            ? error.message
            : '자소서 피드백 생성에 실패했습니다.',
      );
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
      title="AI 자기소개서"
      description="공고를 분석하고 자기소개서 피드백과 수정 초안을 생성합니다."
    >
      {!user ? (
        <LoginRequiredCard
          title="자소서 AI는 로그인한 회원만 사용할 수 있습니다"
          description="공고 분석 저장, 자소서 리포트 생성, 지난 결과 재조회까지 모두 회원 계정 기준으로 동작합니다."
        />
      ) : (
        <div className="space-y-6">
          <SegmentedTabs
            items={[
              { value: 'create', label: '1. 작성하기' },
              { value: 'result', label: '2. 분석 결과' },
            ]}
            value={mainTab}
            onChange={(value) => setMainTab(value as MainTab)}
          />

          {mainTab === 'create' ? (
            <div className="space-y-6">
              <JobAnalysisPanel
                jobForm={jobForm}
                setJobForm={setJobForm}
                jobAnalysis={jobAnalysis}
                analysisError={analysisError}
                isAnalyzing={isAnalyzing}
                onAnalyze={handleAnalyze}
              />
              <FeedbackPanel
                inputMode={inputMode}
                setInputMode={setInputMode}
                feedbackForm={feedbackForm}
                setFeedbackForm={setFeedbackForm}
                setFiles={setFiles}
                feedbackError={feedbackError}
                isSubmittingFeedback={isSubmittingFeedback}
                onSubmitFeedback={handleSubmitFeedback}
              />
            </div>
          ) : (
            <ReportPanel
              report={latestReport}
              resultTab={resultTab}
              setResultTab={setResultTab}
              onBackToCreate={() => setMainTab('create')}
            />
          )}
        </div>
      )}
    </FeatureShell>
  );
}

function JobAnalysisPanel({
  jobForm,
  setJobForm,
  jobAnalysis,
  analysisError,
  isAnalyzing,
  onAnalyze,
}: {
  jobForm: {
    jobUrl: string;
    manualCompanyName: string;
    manualJobTitle: string;
    manualJdText: string;
  };
  setJobForm: React.Dispatch<
    React.SetStateAction<{
      jobUrl: string;
      manualCompanyName: string;
      manualJobTitle: string;
      manualJdText: string;
    }>
  >;
  jobAnalysis: JobAnalysisResponse | null;
  analysisError: string;
  isAnalyzing: boolean;
  onAnalyze: () => void;
}) {
  return (
    <section className="rounded-[8px] bg-white p-7 shadow-[0_18px_50px_rgba(16,36,61,0.07)]">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-[var(--accent)]">1-1</p>
        <h2 className="text-2xl font-bold">공고 분석 만들기</h2>
        <p className="text-sm leading-6 text-[var(--text-muted)]">
          공고 URL 또는 직접 입력한 JD를 기준으로 자기소개서 평가 기준을 준비합니다.
        </p>
      </div>

      <div className="mt-6 grid gap-4">
        <Field label="공고 URL">
          <input
            value={jobForm.jobUrl}
            onChange={(event) =>
              setJobForm((current) => ({
                ...current,
                jobUrl: event.target.value,
              }))
            }
            placeholder="https://careers.example.com/backend-engineer"
            className="form-input"
          />
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="회사명">
            <input
              value={jobForm.manualCompanyName}
              onChange={(event) =>
                setJobForm((current) => ({
                  ...current,
                  manualCompanyName: event.target.value,
                }))
              }
              placeholder="온세상이취업"
              className="form-input"
            />
          </Field>
          <Field label="직무명">
            <input
              value={jobForm.manualJobTitle}
              onChange={(event) =>
                setJobForm((current) => ({
                  ...current,
                  manualJobTitle: event.target.value,
                }))
              }
              placeholder="백엔드 개발자"
              className="form-input"
            />
          </Field>
        </div>

        <Field label="JD 본문">
          <textarea
            value={jobForm.manualJdText}
            onChange={(event) =>
              setJobForm((current) => ({
                ...current,
                manualJdText: event.target.value,
              }))
            }
            rows={5}
            placeholder="주요 업무, 자격 요건, 우대 사항을 붙여넣어 주세요."
            className="form-input"
          />
        </Field>

        {analysisError ? <p className="text-sm text-red-600">{analysisError}</p> : null}

        <button
          type="button"
          onClick={() => void onAnalyze()}
          disabled={isAnalyzing}
          className="rounded-[8px] bg-[var(--accent)] px-5 py-3 font-semibold text-white shadow-[0_12px_28px_rgba(30,111,217,0.22)] disabled:opacity-60"
        >
          {isAnalyzing ? '공고 분석 중...' : '공고 분석 생성'}
        </button>
      </div>

      {jobAnalysis ? (
        <div className="mt-6 rounded-[8px] border border-[var(--border-soft)] bg-[var(--card-soft)] p-5">
          <p className="text-sm font-semibold text-[var(--accent)]">
            {jobAnalysis.companyName} / {jobAnalysis.positionName}
          </p>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--text-muted)]">
            {jobAnalysis.jdText}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(jobAnalysis.extractedSkills ?? []).slice(0, 6).map((skill) => (
              <Chip key={skill}>{skill}</Chip>
            ))}
            {(jobAnalysis.extractedKeywords ?? jobAnalysis.keywords)
              .slice(0, 8)
              .map((keyword) => (
                <Chip key={keyword}>{keyword}</Chip>
              ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function FeedbackPanel({
  inputMode,
  setInputMode,
  feedbackForm,
  setFeedbackForm,
  setFiles,
  feedbackError,
  isSubmittingFeedback,
  onSubmitFeedback,
}: {
  inputMode: 'text' | 'file';
  setInputMode: (mode: 'text' | 'file') => void;
  feedbackForm: {
    jobAnalysisRequestId: string;
    coverLetterText: string;
    resumeText: string;
    portfolioText: string;
  };
  setFeedbackForm: React.Dispatch<
    React.SetStateAction<{
      jobAnalysisRequestId: string;
      coverLetterText: string;
      resumeText: string;
      portfolioText: string;
    }>
  >;
  setFiles: React.Dispatch<
    React.SetStateAction<{
      coverLetterFile: File | null;
      resumeFile: File | null;
      portfolioFile: File | null;
    }>
  >;
  feedbackError: string;
  isSubmittingFeedback: boolean;
  onSubmitFeedback: () => void;
}) {
  return (
    <section className="rounded-[8px] bg-white p-7 shadow-[0_18px_50px_rgba(16,36,61,0.07)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--accent)]">1-2</p>
          <h2 className="mt-2 text-2xl font-bold">자소서 피드백 생성</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            자기소개서와 보조 자료를 입력하면 분석 결과 탭에 리포트가 생성됩니다.
          </p>
        </div>
        <SegmentedTabs
          items={[
            { value: 'text', label: '텍스트 입력' },
            { value: 'file', label: '파일 업로드' },
          ]}
          value={inputMode}
          onChange={(value) => setInputMode(value as 'text' | 'file')}
        />
      </div>

      <div className="mt-6 grid gap-4">
        <Field label="공고 분석 ID">
          <input
            value={feedbackForm.jobAnalysisRequestId}
            onChange={(event) =>
              setFeedbackForm((current) => ({
                ...current,
                jobAnalysisRequestId: event.target.value,
              }))
            }
            placeholder="공고 분석을 만들면 자동으로 입력됩니다."
            className="form-input"
          />
        </Field>

        {inputMode === 'text' ? (
          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Field label="자소서 본문">
              <textarea
                value={feedbackForm.coverLetterText}
                onChange={(event) =>
                  setFeedbackForm((current) => ({
                    ...current,
                    coverLetterText: event.target.value,
                  }))
                }
                rows={10}
                className="form-input"
              />
            </Field>
            <div className="grid gap-4">
              <Field label="이력서 텍스트">
                <textarea
                  value={feedbackForm.resumeText}
                  onChange={(event) =>
                    setFeedbackForm((current) => ({
                      ...current,
                      resumeText: event.target.value,
                    }))
                  }
                  rows={4}
                  className="form-input"
                />
              </Field>
              <Field label="포트폴리오 텍스트">
                <textarea
                  value={feedbackForm.portfolioText}
                  onChange={(event) =>
                    setFeedbackForm((current) => ({
                      ...current,
                      portfolioText: event.target.value,
                    }))
                  }
                  rows={4}
                  className="form-input"
                />
              </Field>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <FileInput
              label="자소서 파일"
              onChange={(file) =>
                setFiles((current) => ({ ...current, coverLetterFile: file }))
              }
            />
            <FileInput
              label="이력서 파일"
              onChange={(file) =>
                setFiles((current) => ({ ...current, resumeFile: file }))
              }
            />
            <FileInput
              label="포트폴리오 파일"
              onChange={(file) =>
                setFiles((current) => ({ ...current, portfolioFile: file }))
              }
            />
          </div>
        )}

        {feedbackError ? <p className="text-sm text-red-600">{feedbackError}</p> : null}

        <button
          type="button"
          onClick={() => void onSubmitFeedback()}
          disabled={isSubmittingFeedback}
          className="rounded-[8px] bg-[var(--card-strong)] px-5 py-3 font-semibold text-white shadow-[0_12px_28px_rgba(16,36,61,0.16)] disabled:opacity-60"
        >
          {isSubmittingFeedback ? '피드백 생성 중...' : '자소서 피드백 생성'}
        </button>
      </div>
    </section>
  );
}

function ReportPanel({
  report,
  resultTab,
  setResultTab,
  onBackToCreate,
}: {
  report: CoverLetterReportDetail | null;
  resultTab: ResultTab;
  setResultTab: (tab: ResultTab) => void;
  onBackToCreate: () => void;
}) {
  if (!report) {
    return (
      <section className="rounded-[8px] bg-white p-8 shadow-[0_18px_50px_rgba(16,36,61,0.07)]">
        <h2 className="text-2xl font-bold">아직 생성된 분석 결과가 없습니다</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
          작성하기 탭에서 공고 분석과 자기소개서 피드백을 생성하면 이곳에서 결과를 확인할 수 있습니다.
        </p>
        <button
          type="button"
          onClick={onBackToCreate}
          className="mt-6 rounded-[8px] bg-[var(--accent)] px-5 py-3 font-semibold text-white"
        >
          작성하러 가기
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-[8px] bg-white p-7 shadow-[0_18px_50px_rgba(16,36,61,0.07)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--accent)]">
            {report.companyName} / {report.positionName}
          </p>
          <h2 className="mt-2 text-3xl font-bold">분석 결과</h2>
        </div>
        <div className="rounded-[8px] bg-[var(--card-strong)] px-6 py-4 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/62">
            Total Score
          </p>
          <p className="mt-1 text-3xl font-bold">{report.totalScore}점</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <ScoreCard label="공고 반영도" value={report.jdAlignmentScore} />
        <ScoreCard label="직무 적합도" value={report.jobFitScore} />
        <ScoreCard
          label="분석 신뢰도"
          value={Math.round((report.confidence ?? 0) * 100)}
          suffix="%"
        />
      </div>

      <div className="mt-6">
        <SegmentedTabs
          items={[
            { value: 'summary', label: '요약' },
            { value: 'questions', label: '문항 피드백' },
            { value: 'draft', label: '수정 초안' },
            { value: 'details', label: '상세 기준' },
          ]}
          value={resultTab}
          onChange={(value) => setResultTab(value as ResultTab)}
        />
      </div>

      <div className="mt-6">
        {resultTab === 'summary' ? <SummaryView report={report} /> : null}
        {resultTab === 'questions' ? (
          <QuestionScoreList items={report.questionScores} />
        ) : null}
        {resultTab === 'draft' ? <DraftCard draft={report.revisedDraft} /> : null}
        {resultTab === 'details' ? (
          <DetailsView
            rubricScores={report.rubricScores}
            ragEvidence={report.ragEvidence}
          />
        ) : null}
      </div>
    </section>
  );
}

function SummaryView({ report }: { report: CoverLetterReportDetail }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-[8px] border border-[var(--border-soft)] bg-[var(--card-soft)] p-5">
        <h3 className="text-xl font-bold">종합 의견</h3>
        <p className="mt-3 leading-7 text-[var(--text-muted)]">{report.summary}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {(report.verifiedJdKeywords ?? []).slice(0, 10).map((keyword) => (
            <Chip key={keyword}>{keyword}</Chip>
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
        <ResultList title="강점" items={report.strengths} />
        <ResultList title="보완점" items={report.weaknesses} />
        <ResultList
          title="다음 액션"
          items={report.nextActions ?? report.revisionDirections}
        />
      </div>
    </div>
  );
}

function DetailsView({
  rubricScores,
  ragEvidence,
}: {
  rubricScores?: CoverLetterRubricScore[];
  ragEvidence?: CoverLetterRagEvidence[];
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-[8px] border border-[var(--border-soft)] bg-[var(--card-soft)] p-5">
        <h3 className="text-xl font-bold">항목별 평가 기준</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
          세부 기준은 검토가 필요할 때만 참고하는 보조 정보입니다.
        </p>
        <RubricScoreList items={rubricScores} />
      </div>

      <details className="rounded-[8px] border border-[var(--border-soft)] bg-white p-5">
        <summary className="cursor-pointer font-bold">검색 근거 보기</summary>
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
          고객 화면에서는 기본적으로 숨기는 내부 참고 근거입니다.
        </p>
        <RagEvidenceList items={ragEvidence} />
      </details>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      {children}
    </label>
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
    <label className="block rounded-[8px] border border-[var(--border-soft)] bg-[var(--card-soft)] p-4">
      <span className="mb-3 block text-sm font-semibold">{label}</span>
      <input
        type="file"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        className="w-full text-sm"
      />
    </label>
  );
}

function SegmentedTabs({
  items,
  value,
  onChange,
}: {
  items: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 rounded-[8px] border border-[var(--border-soft)] bg-white p-2">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={`rounded-[8px] px-4 py-2 text-sm font-semibold ${
            value === item.value
              ? 'bg-[var(--accent)] text-white'
              : 'text-[var(--text-muted)] hover:bg-[var(--card-soft)]'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-[8px] border border-[var(--border-soft)] bg-white px-3 py-2 text-xs font-semibold text-[var(--text-muted)]">
      {children}
    </span>
  );
}

function ResultList({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div className="rounded-[8px] border border-[var(--border-soft)] bg-white p-5">
      <h3 className="font-bold">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--text-muted)]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function ScoreCard({
  label,
  value,
  suffix = '점',
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="rounded-[8px] border border-[var(--border-soft)] bg-[var(--card-soft)] px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold">
        {value}
        {suffix}
      </p>
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
  if (!items || items.length === 0) {
    return (
      <div className="rounded-[8px] border border-[var(--border-soft)] bg-white p-5 text-sm text-[var(--text-muted)]">
        문항별 피드백이 없습니다.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {items.map((item) => (
        <div
          key={`${item.questionNumber}-${item.title}`}
          className="rounded-[8px] border border-[var(--border-soft)] bg-white p-5"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-bold">{item.title}</p>
              <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                {item.feedback}
              </p>
            </div>
            <p className="shrink-0 text-xl font-bold text-[var(--accent)]">
              {item.score}점
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function RubricScoreList({ items }: { items?: CoverLetterRubricScore[] }) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 grid gap-3">
      {items.map((item) => (
        <div
          key={item.category}
          className="rounded-[8px] border border-[var(--border-soft)] bg-white p-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">{item.category}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                {item.evidenceText}
              </p>
            </div>
            <p className="shrink-0 font-bold text-[var(--accent)]">
              {item.score}/{item.maxScore}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function RagEvidenceList({ items }: { items?: CoverLetterRagEvidence[] }) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 grid gap-3">
      {items.slice(0, 5).map((item, index) => (
        <div
          key={`${item.source}-${index}`}
          className="rounded-[8px] border border-[var(--border-soft)] bg-[var(--card-soft)] p-4 text-sm leading-6 text-[var(--text-muted)]"
        >
          <p className="font-semibold text-[var(--text-main)]">
            {item.source} · 유사도 {item.score}
          </p>
          <p className="mt-2">{item.text}</p>
        </div>
      ))}
    </div>
  );
}

function DraftCard({ draft }: { draft: string }) {
  return (
    <div className="rounded-[8px] border border-[var(--border-soft)] bg-white p-5">
      <h3 className="text-xl font-bold">자소서 수정 초안</h3>
      <pre className="mt-4 max-h-[620px] overflow-auto whitespace-pre-wrap rounded-[8px] bg-[var(--card-soft)] p-5 text-sm leading-7 text-[var(--text-muted)]">
        {draft || '생성된 수정 초안이 없습니다.'}
      </pre>
    </div>
  );
}

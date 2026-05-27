'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FeatureShell } from '@/components/feature-shell';
import { ApiError, apiRequest } from '@/lib/api';
import { getAccessToken, getStoredUser, type AuthUser } from '@/lib/auth';

type PostSummary = {
  id: number;
  title: string;
  author: string;
  likes: number;
  views: number;
  createdAt: string;
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
  nextActions: string[];
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

type InterviewReportSummary = {
  sessionId: string;
  companyName: string;
  positionName: string;
  status: string;
  currentQuestionNumber: number;
  createdAt: string;
  finishedAt?: string | null;
  finalTotalScore?: number | null;
  finalGrade?: string | null;
};

type InterviewReportDetail = InterviewReportSummary & {
  finalReport?: {
    totalScore: number;
    grade: string;
    summary: string;
    strengths: string[];
    weaknesses: string[];
    practiceDirections: string[];
    questionAnswers: {
      turnNumber: number;
      questionText: string;
      answerFullText: string;
    }[];
    turnFeedbacks: {
      turnNumber: number;
      questionText: string;
      feedbackText: string;
      nonverbalSummaryText: string;
    }[];
  } | null;
};

type ActiveReportModal =
  | { type: 'cover-letter'; report: CoverLetterReportDetail }
  | { type: 'interview'; report: InterviewReportDetail }
  | null;

export default function MyPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [myPosts, setMyPosts] = useState<PostSummary[]>([]);
  const [likedPosts, setLikedPosts] = useState<PostSummary[]>([]);
  const [coverLetterReports, setCoverLetterReports] = useState<
    CoverLetterReportSummary[]
  >([]);
  const [interviewReports, setInterviewReports] = useState<
    InterviewReportSummary[]
  >([]);
  const [selectedReportId, setSelectedReportId] = useState('');
  const [activeReportModal, setActiveReportModal] =
    useState<ActiveReportModal>(null);
  const [reportError, setReportError] = useState('');

  useEffect(() => {
    const currentUser = getStoredUser();
    const accessToken = getAccessToken();

    // 2026-05-16 수정: 보호 페이지 접근 기준을 토큰 존재 여부로 맞춰 사용자 캐시 누락 시에도 접근을 막지 않음
    if (!accessToken) {
      setUser(null);
      return;
    }

    // 2026-05-16 수정: 저장된 사용자 정보가 없어도 토큰 기반 API 검증을 먼저 진행하도록 기본 표시값을 사용함
    setUser(
      currentUser ?? {
        id: '',
        email: '',
        username: '',
        displayName: '로그인 사용자',
        role: 'USER',
      },
    );

    const loadMyPageData = async () => {
      const [authored, liked, reports, interviewSessions] = await Promise.all([
        apiRequest<PostSummary[]>('/posts/me/authored'),
        apiRequest<PostSummary[]>('/posts/me/liked'),
        apiRequest<CoverLetterReportSummary[]>('/ai/cover-letter/reports'),
        apiRequest<InterviewReportSummary[]>('/ai/interview/sessions'),
      ]);

      setMyPosts(authored);
      setLikedPosts(liked);
      setCoverLetterReports(reports);
      setInterviewReports(
        interviewSessions.filter(
          (session) =>
            session.status === 'FINISHED' && session.finalTotalScore !== null,
        ),
      );
    };

    void loadMyPageData();
  }, []);

  const handleSelectReport = async (reportId: string) => {
    setSelectedReportId(reportId);
    setReportError('');

    try {
      const detail = await apiRequest<CoverLetterReportDetail>(
        `/ai/cover-letter/reports/${reportId}`,
      );
      setActiveReportModal({ type: 'cover-letter', report: detail });
    } catch (error) {
      setReportError(
        error instanceof ApiError
          ? error.message
          : '자소서 리포트를 불러오지 못했습니다.',
      );
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    setReportError('');
    try {
      await apiRequest<void>(`/ai/cover-letter/reports/${reportId}`, {
        method: 'DELETE',
      });
      setCoverLetterReports((current) =>
        current.filter((report) => report.reportId !== reportId),
      );
      if (selectedReportId === reportId) {
        setSelectedReportId('');
        setActiveReportModal(null);
      }
    } catch (error) {
      setReportError(
        error instanceof ApiError
          ? error.message
          : '자소서 리포트를 삭제하지 못했습니다.',
      );
    }
  };

  const handleSelectInterviewReport = async (sessionId: string) => {
    setSelectedReportId(sessionId);
    setReportError('');

    try {
      const detail = await apiRequest<InterviewReportDetail>(
        `/ai/interview/sessions/${sessionId}`,
      );
      setActiveReportModal({ type: 'interview', report: detail });
    } catch (error) {
      setReportError(
        error instanceof ApiError
          ? error.message
          : '면접 리포트를 불러오지 못했습니다.',
      );
    }
  };

  const handleDeleteInterviewReport = async (sessionId: string) => {
    setReportError('');
    try {
      await apiRequest<void>(`/ai/interview/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      setInterviewReports((current) =>
        current.filter((report) => report.sessionId !== sessionId),
      );
      if (selectedReportId === sessionId) {
        setSelectedReportId('');
        setActiveReportModal(null);
      }
    } catch (error) {
      setReportError(
        error instanceof ApiError
          ? error.message
          : '면접 리포트를 삭제하지 못했습니다.',
      );
    }
  };

  return (
    <FeatureShell
      eyebrow="My Page"
      title="마이페이지"
      description="내 활동과 저장된 자소서·면접 리포트를 한 곳에서 다시 확인할 수 있습니다."
    >
      {user ? (
        <>
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <section className="rounded-[28px] bg-white p-8 shadow-[0_18px_50px_rgba(16,36,61,0.07)]">
              <div className="space-y-4 rounded-[28px] bg-[var(--card-soft)] p-6">
                <InfoRow label="이름" value={user.displayName} />
                <InfoRow label="이메일" value={user.email} />
                <InfoRow label="아이디" value={user.username} />
                <InfoRow label="권한" value={user.role} />
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <PostListCard
                  title="내가 쓴 글"
                  emptyMessage="작성한 게시글이 없습니다."
                  posts={myPosts}
                />
                <PostListCard
                  title="내가 좋아요한 글"
                  emptyMessage="좋아요한 게시글이 없습니다."
                  posts={likedPosts}
                />
              </div>
            </section>

            <section className="rounded-[28px] bg-white p-8 shadow-[0_18px_50px_rgba(16,36,61,0.07)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold">저장된 자소서 리포트</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                    상세 내용은 목록에서 선택하면 팝업으로 표시됩니다.
                  </p>
                </div>
                <Link
                  href="/ai_cover_letter"
                  className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
                >
                  새 리포트 만들기
                </Link>
              </div>

              <div className="mt-5 space-y-3">
                {coverLetterReports.length === 0 ? (
                  <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--card-soft)] px-4 py-4 text-sm text-[var(--text-muted)]">
                    아직 저장된 자소서 리포트가 없습니다.
                  </div>
                ) : null}
                {coverLetterReports.map((report) => (
                  <div
                    key={report.reportId}
                    className={`rounded-2xl border px-4 py-4 ${
                      selectedReportId === report.reportId
                        ? 'border-[var(--accent)] bg-[var(--card-soft)]'
                        : 'border-[var(--border-soft)] bg-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => void handleSelectReport(report.reportId)}
                      className="w-full text-left"
                    >
                      <p className="text-sm font-semibold">{report.companyName}</p>
                      <p className="mt-1 text-sm">{report.positionName}</p>
                      <p className="mt-2 text-xs text-[var(--text-muted)]">
                        점수 {report.totalScore} /{' '}
                        {new Date(report.createdAt).toLocaleString()}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteReport(report.reportId)}
                      className="mt-3 rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] bg-white p-8 shadow-[0_18px_50px_rgba(16,36,61,0.07)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold">저장된 면접 리포트</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                    AI 면접에서 5문항 이상 완료해 생성된 최종 리포트입니다.
                  </p>
                </div>
                <Link
                  href="/ai_interview"
                  className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
                >
                  면접 연습하기
                </Link>
              </div>

              <div className="mt-5 space-y-3">
                {interviewReports.length === 0 ? (
                  <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--card-soft)] px-4 py-4 text-sm text-[var(--text-muted)]">
                    아직 저장된 면접 리포트가 없습니다.
                  </div>
                ) : null}
                {interviewReports.map((report) => (
                  <div
                    key={report.sessionId}
                    className={`rounded-2xl border px-4 py-4 ${
                      selectedReportId === report.sessionId
                        ? 'border-[var(--accent)] bg-[var(--card-soft)]'
                        : 'border-[var(--border-soft)] bg-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        void handleSelectInterviewReport(report.sessionId)
                      }
                      className="w-full text-left"
                    >
                      <p className="text-sm font-semibold">{report.companyName}</p>
                      <p className="mt-1 text-sm">{report.positionName}</p>
                      <p className="mt-2 text-xs text-[var(--text-muted)]">
                        점수 {report.finalTotalScore ?? '-'} /{' '}
                        {report.finalGrade ?? '등급 없음'} /{' '}
                        {new Date(report.finishedAt ?? report.createdAt).toLocaleString()}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void handleDeleteInterviewReport(report.sessionId)
                      }
                      className="mt-3 rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-[28px] bg-[var(--card-strong)] p-7 text-white">
              <h2 className="text-xl font-bold">바로가기</h2>
              <div className="mt-4 flex flex-col gap-3">
                <Link
                  className="rounded-2xl border border-white/20 px-4 py-3 font-semibold"
                  href="/board"
                >
                  게시판 보러 가기
                </Link>
                <Link
                  className="rounded-2xl border border-white/20 px-4 py-3 font-semibold"
                  href="/dataroom"
                >
                  자료실 보러 가기
                </Link>
                <Link
                  className="rounded-2xl border border-white/20 px-4 py-3 font-semibold"
                  href="/ai_cover_letter"
                >
                  AI 자소서 페이지
                </Link>
                <Link
                  className="rounded-2xl border border-white/20 px-4 py-3 font-semibold"
                  href="/ai_interview"
                >
                  AI 면접 페이지
                </Link>
              </div>
            </section>

            {reportError ? (
              <section className="rounded-[28px] border border-red-100 bg-red-50 p-6 text-sm text-red-700">
                {reportError}
              </section>
            ) : null}

            <section className="rounded-[28px] bg-white p-6 shadow-[0_18px_50px_rgba(16,36,61,0.07)]">
              <h2 className="text-xl font-bold">리포트 보기</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                자소서 또는 면접 리포트를 선택하면 상세 내용이 팝업으로 열립니다.
              </p>
            </section>
          </div>
        </div>
        {activeReportModal ? (
          <ReportModal
            modal={activeReportModal}
            onClose={() => {
              setActiveReportModal(null);
              setSelectedReportId('');
            }}
            onDeleteCoverLetter={handleDeleteReport}
            onDeleteInterview={handleDeleteInterviewReport}
          />
        ) : null}
        </>
      ) : (
        <div className="rounded-[28px] border border-[var(--border-soft)] bg-white p-8">
          <p className="text-[var(--text-muted)]">먼저 로그인해 주세요.</p>
          <Link
            className="mt-4 inline-block font-semibold text-[var(--accent)]"
            href="/login"
          >
            로그인 페이지로 이동
          </Link>
        </div>
      )}
    </FeatureShell>
  );
}

function ReportModal({
  modal,
  onClose,
  onDeleteCoverLetter,
  onDeleteInterview,
}: {
  modal: Exclude<ActiveReportModal, null>;
  onClose: () => void;
  onDeleteCoverLetter: (reportId: string) => void;
  onDeleteInterview: (sessionId: string) => void;
}) {
  const isCoverLetter = modal.type === 'cover-letter';
  const title = isCoverLetter ? '자소서 리포트 상세' : '면접 리포트 상세';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
      <section className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-[8px] bg-white p-6 shadow-[0_24px_90px_rgba(0,0,0,0.28)]">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-soft)] pb-4">
          <div>
            <p className="text-sm font-semibold text-[var(--accent)]">{title}</p>
            <h2 className="mt-1 text-2xl font-bold">
              {modal.report.companyName} / {modal.report.positionName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[8px] border border-[var(--border-soft)] px-3 py-2 text-sm font-semibold"
          >
            닫기
          </button>
        </div>

        {isCoverLetter ? (
          <CoverLetterReportDetailView report={modal.report} />
        ) : (
          <InterviewReportDetailView report={modal.report} />
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => {
              if (isCoverLetter) {
                onDeleteCoverLetter(modal.report.reportId);
              } else {
                onDeleteInterview(modal.report.sessionId);
              }
            }}
            className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600"
          >
            이 리포트 삭제
          </button>
        </div>
      </section>
    </div>
  );
}

function CoverLetterReportDetailView({
  report,
}: {
  report: CoverLetterReportDetail;
}) {
  return (
    <div className="mt-5 space-y-5">
      <div className="rounded-[8px] bg-[var(--card-soft)] p-5">
        <p className="text-3xl font-bold">{report.totalScore}점</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <ScoreCard label="JD 반영도" value={report.jdAlignmentScore} />
          <ScoreCard label="직무 적합도" value={report.jobFitScore} />
        </div>
        <TrustSummary
          confidence={report.confidence}
          keywords={report.verifiedJdKeywords}
        />
        <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
          {report.summary}
        </p>
      </div>

      <QuestionScoreList items={report.questionScores} />
      <RubricScoreList items={report.rubricScores} />
      <RagEvidenceList items={report.ragEvidence} />
      <SimpleList title="강점" items={report.strengths} />
      <SimpleList title="보완점" items={report.weaknesses} />
      <SimpleList title="다음 액션" items={report.nextActions} />
      <DraftCard draft={report.revisedDraft} />
    </div>
  );
}

function InterviewReportDetailView({
  report,
}: {
  report: InterviewReportDetail;
}) {
  if (!report.finalReport) {
    return (
      <p className="mt-5 rounded-[8px] bg-[var(--warning-soft)] p-4 text-sm leading-6 text-[var(--text-muted)]">
        최종 리포트가 생성되지 않은 면접 세션입니다.
      </p>
    );
  }

  return (
    <div className="mt-5 space-y-5">
      <div className="rounded-[8px] bg-[var(--card-soft)] p-5">
        <p className="text-3xl font-bold">{report.finalReport.totalScore}점</p>
        <p className="mt-2 font-semibold">{report.finalReport.grade}</p>
        <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
          {report.finalReport.summary}
        </p>
      </div>
      <SimpleList title="강점" items={report.finalReport.strengths} />
      <SimpleList title="보완점" items={report.finalReport.weaknesses} />
      <SimpleList
        title="연습 방향"
        items={report.finalReport.practiceDirections}
      />
      <InterviewQuestionAnswerList items={report.finalReport.questionAnswers} />
      <InterviewFeedbackList items={report.finalReport.turnFeedbacks} />
    </div>
  );
}

function InterviewQuestionAnswerList({
  items,
}: {
  items: {
    turnNumber: number;
    questionText: string;
    answerFullText: string;
  }[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="text-lg font-bold">질문과 답변</h3>
      <div className="mt-3 space-y-3">
        {items.map((item) => (
          <div
            key={`qa-${item.turnNumber}`}
            className="rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-4 text-sm leading-6"
          >
            <p className="font-semibold">
              {item.turnNumber}. {item.questionText}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-[var(--text-muted)]">
              {item.answerFullText}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function InterviewFeedbackList({
  items,
}: {
  items: {
    turnNumber: number;
    questionText: string;
    feedbackText: string;
    nonverbalSummaryText: string;
  }[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="text-lg font-bold">턴별 피드백</h3>
      <div className="mt-3 space-y-3">
        {items.map((item) => (
          <div
            key={`feedback-${item.turnNumber}`}
            className="rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-4 text-sm leading-6"
          >
            <p className="font-semibold">
              {item.turnNumber}. {item.questionText}
            </p>
            <p className="mt-2 text-[var(--text-muted)]">{item.feedbackText}</p>
            <p className="mt-2 text-[var(--text-muted)]">
              {item.nonverbalSummaryText}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-2xl bg-white px-4 py-3 sm:grid-cols-[120px_1fr]">
      <span className="text-sm font-semibold text-[var(--text-muted)]">
        {label}
      </span>
      <span className="break-all">{value}</span>
    </div>
  );
}

function PostListCard({
  title,
  emptyMessage,
  posts,
}: {
  title: string;
  emptyMessage: string;
  posts: PostSummary[];
}) {
  return (
    <div className="rounded-[28px] border border-[var(--border-soft)] bg-white p-5">
      <h3 className="text-lg font-bold">{title}</h3>
      <div className="mt-4 space-y-3">
        {posts.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">{emptyMessage}</p>
        ) : null}
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/board/${post.id}`}
            className="block rounded-2xl bg-[var(--card-soft)] px-4 py-3"
          >
            <p className="font-semibold">{post.title}</p>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              좋아요 {post.likes} · 조회수 {post.views}
            </p>
          </Link>
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

function SimpleList({ title, items }: { title: string; items: string[] }) {
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

function DraftCard({ draft }: { draft: string }) {
  return (
    <div>
      <h3 className="text-lg font-bold">자소서 수정 초안</h3>
      <div className="mt-3 rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-4">
        {draft ? (
          <pre className="whitespace-pre-wrap text-sm leading-7 text-[var(--text-muted)]">
            {draft}
          </pre>
        ) : (
          <p className="text-sm leading-6 text-[var(--text-muted)]">
            이번에는 생성된 초안이 내부 재평가 기준을 통과하지 못해 표시하지 않았습니다.
          </p>
        )}
      </div>
    </div>
  );
}

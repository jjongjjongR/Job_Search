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

export default function MyPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [myPosts, setMyPosts] = useState<PostSummary[]>([]);
  const [likedPosts, setLikedPosts] = useState<PostSummary[]>([]);
  const [coverLetterReports, setCoverLetterReports] = useState<
    CoverLetterReportSummary[]
  >([]);
  const [selectedReportId, setSelectedReportId] = useState('');
  const [selectedReport, setSelectedReport] =
    useState<CoverLetterReportDetail | null>(null);
  const [reportError, setReportError] = useState('');

  useEffect(() => {
    const currentUser = getStoredUser();
    const accessToken = getAccessToken();

    if (!currentUser || !accessToken) {
      setUser(null);
      return;
    }

    setUser(currentUser);

    const loadMyPageData = async () => {
      const [authored, liked, reports] = await Promise.all([
        apiRequest<PostSummary[]>('/posts/me/authored'),
        apiRequest<PostSummary[]>('/posts/me/liked'),
        apiRequest<CoverLetterReportSummary[]>('/ai/cover-letter/reports'),
      ]);

      setMyPosts(authored);
      setLikedPosts(liked);
      setCoverLetterReports(reports);
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
      setSelectedReport(detail);
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
        setSelectedReport(null);
      }
    } catch (error) {
      setReportError(
        error instanceof ApiError
          ? error.message
          : '자소서 리포트를 삭제하지 못했습니다.',
      );
    }
  };

  return (
    <FeatureShell
      eyebrow="My Page"
      title="내 계정과 저장된 AI 리포트"
      description="현재 로그인한 사용자의 기본 정보를 확인하고, 저장된 자소서 리포트와 수정 초안을 마이페이지에서 다시 볼 수 있습니다."
    >
      {user ? (
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <section className="rounded-[28px] bg-white p-8 shadow-[0_18px_50px_rgba(16,36,61,0.07)]">
              <div className="space-y-4 rounded-[28px] bg-[var(--card-soft)] p-6">
                <InfoRow label="이름" value={user.displayName} />
                <InfoRow label="이메일" value={user.email} />
                <InfoRow label="username" value={user.username} />
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
                    AI 자소서 페이지에서 생성한 평가 결과와 수정 초안을 여기서 다시 볼 수 있습니다.
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
              </div>
            </section>

            <section className="rounded-[28px] bg-white p-8 shadow-[0_18px_50px_rgba(16,36,61,0.07)]">
              <h2 className="text-2xl font-bold">리포트 상세</h2>
              {reportError ? (
                <p className="mt-4 text-sm text-red-600">{reportError}</p>
              ) : null}
              {!selectedReport ? (
                <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">
                  왼쪽에서 자소서 리포트를 선택하면 평가 결과와 수정 초안이 여기에 표시됩니다.
                </p>
              ) : (
                <div className="mt-5 space-y-5">
                  <div className="rounded-[24px] bg-[var(--card-soft)] p-5">
                    <p className="text-sm font-semibold text-[var(--accent)]">
                      {selectedReport.companyName} / {selectedReport.positionName}
                    </p>
                    <p className="mt-3 text-3xl font-bold">
                      {selectedReport.totalScore}점
                    </p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <ScoreCard
                        label="JD 반영도"
                        value={selectedReport.jdAlignmentScore}
                      />
                      <ScoreCard
                        label="직무 적합도"
                        value={selectedReport.jobFitScore}
                      />
                    </div>
                    <TrustSummary
                      confidence={selectedReport.confidence}
                      keywords={selectedReport.verifiedJdKeywords}
                    />
                    <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                      {selectedReport.summary}
                    </p>
                  </div>

                  <QuestionScoreList items={selectedReport.questionScores} />
                  <RubricScoreList items={selectedReport.rubricScores} />
                  <RagEvidenceList items={selectedReport.ragEvidence} />
                  <SimpleList title="강점" items={selectedReport.strengths} />
                  <SimpleList title="보완점" items={selectedReport.weaknesses} />
                  <SimpleList
                    title="다음 액션"
                    items={selectedReport.nextActions}
                  />
                  <DraftCard draft={selectedReport.revisedDraft} />
                  <button
                    type="button"
                    onClick={() => void handleDeleteReport(selectedReport.reportId)}
                    className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600"
                  >
                    이 리포트 삭제
                  </button>
                </div>
              )}
            </section>
          </div>
        </div>
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

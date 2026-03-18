'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { clearAuth, getStoredUser, type AuthUser } from '@/lib/auth';

export default function HomePage() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  const handleLogout = () => {
    clearAuth();
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <section className="space-y-8 py-8">
      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.75fr]">
        <div className="overflow-hidden rounded-[40px] border border-[var(--border-soft)] bg-[var(--page-panel)] shadow-[0_26px_90px_rgba(16,36,61,0.08)] backdrop-blur">
          <div className="grid gap-8 p-8 lg:grid-cols-[1.15fr_0.85fr] lg:p-10">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--accent)]">
                Career Platform
              </p>
              <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">
                로그인부터 게시판, 자료실, AI 준비 기능까지 한 흐름으로 연결된 취업 사이트
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--text-muted)]">
                회원가입 후 로그인하면 게시판과 자료실 콘텐츠를 볼 수 있고, JWT 기반 보호
                API로 사용자 정보를 안전하게 관리합니다. 다음 단계에서는 내부 FastAPI AI
                서버까지 자연스럽게 이어집니다.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                {user ? (
                  <>
                    <Link className="rounded-full bg-[var(--accent)] px-5 py-3 font-semibold text-white shadow-[0_12px_28px_rgba(30,111,217,0.28)]" href="/board">
                      게시판 보러가기
                    </Link>
                    <Link className="rounded-full border border-[var(--border-soft)] bg-white px-5 py-3 font-semibold" href="/dataroom">
                      자료실 보러가기
                    </Link>
                  </>
                ) : (
                  <>
                    <Link className="rounded-full bg-[var(--accent)] px-5 py-3 font-semibold text-white shadow-[0_12px_28px_rgba(30,111,217,0.28)]" href="/signup">
                      회원가입 시작
                    </Link>
                    <Link className="rounded-full border border-[var(--border-soft)] bg-white px-5 py-3 font-semibold" href="/login">
                      로그인
                    </Link>
                  </>
                )}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[28px] bg-[var(--card-strong)] p-6 text-white shadow-[0_20px_50px_rgba(16,36,61,0.18)]">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/70">
                  Account
                </p>
                <h2 className="mt-3 text-2xl font-bold">
                  {user ? `${user.displayName}님, 환영합니다` : '로그인이 필요합니다'}
                </h2>
                <p className="mt-3 leading-7 text-white/78">
                  {user
                    ? '이제 게시판 글, 댓글, 자료실 문서를 확인하고 실제 사이트 흐름을 테스트할 수 있습니다.'
                    : '로그인하지 않으면 게시판과 자료실의 실제 내용은 보이지 않도록 보호됩니다.'}
                </p>
                {user ? (
                  <button
                    className="mt-5 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold"
                    onClick={handleLogout}
                  >
                    로그아웃
                  </button>
                ) : null}
              </div>

              <div className="rounded-[28px] border border-[var(--border-soft)] bg-white p-6">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
                  Included Now
                </p>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--text-muted)]">
                  <li>JWT 기반 자체 로그인</li>
                  <li>회원 전용 게시판과 댓글</li>
                  <li>회원 전용 자료실과 파일 다운로드</li>
                  <li>Swagger로 바로 테스트 가능한 인증 API</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <InfoCard
            eyebrow="Community"
            title="게시판"
            description="취업 준비 경험과 질문을 공유하는 커뮤니티 공간"
            href="/board"
          />
          <InfoCard
            eyebrow="Library"
            title="자료실"
            description="이력서, 포트폴리오, 면접 준비 문서를 모아보는 공간"
            href="/dataroom"
          />
          <InfoCard
            eyebrow="AI Ready"
            title="AI 확장 준비"
            description="FastAPI 내부 서버와 멀티 에이전트 구조를 위한 환경까지 미리 준비"
            href="/ai_interview"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard value="JWT" label="보호 경계" />
        <StatCard value="NestJS" label="인증 게이트웨이" />
        <StatCard value="Next.js" label="사용자 웹 경험" />
      </div>
    </section>
  );
}

function InfoCard({
  eyebrow,
  title,
  description,
  href,
}: {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-[30px] border border-[var(--border-soft)] bg-white p-6 shadow-[0_16px_40px_rgba(16,36,61,0.05)] transition hover:-translate-y-0.5"
    >
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-2xl font-bold">{title}</h2>
      <p className="mt-3 leading-7 text-[var(--text-muted)]">{description}</p>
    </Link>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-[28px] border border-[var(--border-soft)] bg-white p-6 shadow-[0_12px_36px_rgba(16,36,61,0.05)]">
      <div className="text-3xl font-bold">{value}</div>
      <div className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </div>
    </div>
  );
}

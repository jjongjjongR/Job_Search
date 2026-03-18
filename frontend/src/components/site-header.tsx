'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  AUTH_STATE_CHANGED_EVENT,
  clearAuth,
  getStoredUser,
  type AuthUser,
} from '@/lib/auth';

export function SiteHeader() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const syncUser = () => setUser(getStoredUser());

    syncUser();
    window.addEventListener('storage', syncUser);
    // 2026-03-18 신규: 같은 탭 로그인/로그아웃도 즉시 반영하기 위해 커스텀 이벤트 구독
    window.addEventListener(AUTH_STATE_CHANGED_EVENT, syncUser);

    return () => {
      window.removeEventListener('storage', syncUser);
      window.removeEventListener(AUTH_STATE_CHANGED_EVENT, syncUser);
    };
  }, []);

  const handleLogout = () => {
    clearAuth();
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <header className="relative mb-4 overflow-hidden rounded-[36px] border border-[var(--border-soft)] bg-[var(--page-panel)] px-6 py-5 shadow-[0_20px_60px_rgba(16,36,61,0.08)] backdrop-blur">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/45 to-transparent" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--card-strong)] text-lg font-bold text-white shadow-[0_10px_24px_rgba(16,36,61,0.2)]">
            W
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
              World Job Search
            </p>
            <Link href="/" className="mt-1 block text-2xl font-bold tracking-tight sm:text-3xl">
              취업 준비를 위한 통합 포털
            </Link>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
              로그인, 게시판, 자료실, AI 준비 기능을 한 흐름으로 묶은 서비스형 화면으로
              정리했습니다.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          {user ? (
            <>
              <span className="rounded-full border border-[var(--border-soft)] bg-[var(--card-soft)] px-4 py-2 font-medium">
                {user.displayName} 님
              </span>
              <Link
                className="rounded-full border border-[var(--border-soft)] bg-white px-4 py-2 font-semibold"
                href="/mypage"
              >
                마이페이지
              </Link>
              <button
                className="rounded-full bg-[var(--card-strong)] px-4 py-2 font-semibold text-white shadow-[0_10px_24px_rgba(16,36,61,0.18)]"
                onClick={handleLogout}
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link className="rounded-full border border-[var(--border-soft)] bg-white px-4 py-2 font-semibold" href="/login">
                로그인
              </Link>
              <Link className="rounded-full bg-[var(--accent)] px-4 py-2 font-semibold text-white shadow-[0_10px_24px_rgba(30,111,217,0.28)]" href="/signup">
                회원가입
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

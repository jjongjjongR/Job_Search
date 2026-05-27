'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  AUTH_STATE_CHANGED_EVENT,
  clearAuth,
  getStoredUser,
  type AuthUser,
} from '@/lib/auth';

export function SiteHeader() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const pathname = usePathname();

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

  // 2026-05-05 신규: AI 면접은 집중형 전용 화면으로 보여주기 위해 공통 헤더를 숨김
  if (pathname === '/ai_interview') {
    return null;
  }

  return (
    <header className="relative mb-4 overflow-hidden rounded-[8px] border border-[var(--border-soft)] bg-[var(--page-panel)] px-5 py-4 shadow-[0_18px_48px_rgba(16,36,61,0.07)] backdrop-blur">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/45 to-transparent" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <Link
            href="/"
            aria-label="메인 페이지로 이동"
            className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-white shadow-[0_10px_24px_rgba(16,36,61,0.12)]"
          >
            <Image
              src="/world_JobSearch_logo.png"
              alt="World Job Search"
              width={56}
              height={56}
              priority
              className="h-full w-full object-cover"
            />
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
              World Job Search
            </p>
            <Link href="/" className="mt-1 block text-2xl font-bold tracking-tight sm:text-3xl">
              온세상이취업
            </Link>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
              채용 정보 정리부터 자기소개서와 면접 준비까지 한 곳에서 이어지는 취업 준비 서비스입니다.
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
                className="rounded-[8px] border border-[var(--border-soft)] bg-white px-4 py-2 font-semibold"
                href="/mypage"
              >
                마이페이지
              </Link>
              <button
                className="rounded-[8px] bg-[var(--card-strong)] px-4 py-2 font-semibold text-white shadow-[0_10px_24px_rgba(16,36,61,0.18)]"
                onClick={handleLogout}
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link className="rounded-[8px] border border-[var(--border-soft)] bg-white px-4 py-2 font-semibold" href="/login">
                로그인
              </Link>
              <Link className="rounded-[8px] bg-[var(--accent)] px-4 py-2 font-semibold text-white shadow-[0_10px_24px_rgba(30,111,217,0.28)]" href="/signup">
                회원가입
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

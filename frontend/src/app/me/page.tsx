'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FeatureShell } from '@/components/feature-shell';
import { ApiError, apiRequest } from '@/lib/api';
import { clearAuth, getAccessToken, type AuthUser } from '@/lib/auth';

export default function MePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadMe = async () => {
      if (!getAccessToken()) {
        setErrorMessage('로그인이 필요합니다. 먼저 로그인 페이지로 이동해 주세요.');
        setIsLoading(false);
        return;
      }

      try {
        const result = await apiRequest<AuthUser>('/users/me');
        setUser(result);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          clearAuth();
          setErrorMessage('토큰이 없거나 만료되었습니다. 다시 로그인해 주세요.');
        } else {
          setErrorMessage('내 정보 조회에 실패했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    void loadMe();
  }, []);

  const handleLogout = () => {
    clearAuth();
    window.location.href = '/login';
  };

  return (
    <FeatureShell
      eyebrow="Protected Page"
      title="내 정보 조회"
      description="저장된 access token을 Authorization 헤더에 담아 GET /users/me 보호 API를 호출합니다."
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.7fr]">
        <div className="rounded-[28px] bg-white p-8 shadow-[0_18px_50px_rgba(16,36,61,0.07)]">
          {isLoading ? <p>사용자 정보를 불러오는 중...</p> : null}

          {!isLoading && errorMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
              <p className="text-red-700">{errorMessage}</p>
              <Link className="mt-4 inline-block font-semibold text-[var(--accent)]" href="/login">
                로그인 페이지로 이동
              </Link>
            </div>
          ) : null}

          {!isLoading && user ? (
            <div className="space-y-4 rounded-[28px] bg-[var(--card-soft)] p-6">
              <InfoRow label="id" value={user.id} />
              <InfoRow label="email" value={user.email} />
              <InfoRow label="username" value={user.username} />
              <InfoRow label="displayName" value={user.displayName} />
              <InfoRow label="role" value={user.role} />

              <button
                className="mt-4 rounded-full bg-[var(--card-strong)] px-4 py-2 font-semibold text-white"
                onClick={handleLogout}
              >
                로그아웃
              </button>
            </div>
          ) : null}
        </div>

        <div className="rounded-[28px] bg-[var(--card-strong)] p-7 text-white">
          <h2 className="text-xl font-bold">보호 API 체크 포인트</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-white/78">
            <li>토큰이 없으면 호출 전에 로그인 안내를 보여줍니다.</li>
            <li>401이 오면 저장된 토큰을 정리해 잘못된 인증 상태를 비웁니다.</li>
            <li>현재 응답은 최소 사용자 정보만 반환하도록 제한했습니다.</li>
          </ul>
        </div>
      </div>
    </FeatureShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-2xl bg-white px-4 py-3 sm:grid-cols-[140px_1fr]">
      <span className="text-sm font-semibold text-[var(--text-muted)]">{label}</span>
      <span className="break-all">{value}</span>
    </div>
  );
}

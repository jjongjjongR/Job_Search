'use client';

import { getSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FeatureShell } from '@/components/feature-shell';
import { apiRequest, ApiError } from '@/lib/api';
import { saveAuth, type LoginResponse } from '@/lib/auth';

export default function SocialCallbackPage() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const completeSocialLogin = async () => {
      try {
        const session = (await getSession()) as
          | {
              provider?: string;
              user?: {
                email?: string | null;
                name?: string | null;
              };
            }
          | null;
        const provider = session?.provider;
        const email = session?.user?.email;
        const displayName = session?.user?.name ?? email?.split('@')[0] ?? '';

        if (!provider || !email || !displayName) {
          throw new Error('소셜 로그인 정보를 확인할 수 없습니다.');
        }

        const result = await apiRequest<LoginResponse>('/auth/social-login', {
          method: 'POST',
          body: JSON.stringify({
            provider,
            email,
            displayName,
          }),
        });

        saveAuth(result);
        await signOut({ redirect: false });
        router.replace('/');
      } catch (error) {
        setErrorMessage(
          error instanceof ApiError
            ? error.message
            : '소셜 로그인 연결에 실패했습니다.',
        );
      }
    };

    void completeSocialLogin();
  }, [router]);

  return (
    <FeatureShell
      eyebrow="Social Login"
      title="소셜 로그인 처리 중"
      description="소셜 계정을 우리 서비스 로그인 상태로 연결하고 있습니다."
    >
      <div className="rounded-[28px] bg-white p-8 shadow-[0_18px_50px_rgba(16,36,61,0.07)]">
        {errorMessage ? (
          <p className="text-sm text-red-600">{errorMessage}</p>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            잠시만 기다려 주세요. 로그인 정보를 확인하고 있습니다.
          </p>
        )}
      </div>
    </FeatureShell>
  );
}

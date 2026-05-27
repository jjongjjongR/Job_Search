'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FeatureShell } from '@/components/feature-shell';
import { ApiError, apiRequest } from '@/lib/api';

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  const [message, setMessage] = useState('이메일 인증을 확인하고 있습니다.');

  useEffect(() => {
    const verify = async () => {
      const token = new URLSearchParams(window.location.search).get('token');

      if (!token) {
        setStatus('error');
        setMessage('인증 링크가 올바르지 않습니다.');
        return;
      }

      try {
        await apiRequest(`/auth/verify-email?token=${encodeURIComponent(token)}`);
        setStatus('success');
        setMessage('이메일 인증이 완료되었습니다. 이제 로그인할 수 있습니다.');
      } catch (error) {
        setStatus('error');
        setMessage(
          error instanceof ApiError
            ? error.message
            : '이메일 인증에 실패했습니다.',
        );
      }
    };

    void verify();
  }, []);

  return (
    <FeatureShell
      eyebrow="Email Verification"
      title="이메일 인증"
      description="회원가입에 사용한 Gmail 주소를 확인합니다."
    >
      <div className="rounded-[28px] bg-white p-8 shadow-[0_18px_50px_rgba(16,36,61,0.07)]">
        <p
          className={`rounded-2xl px-4 py-3 text-sm ${
            status === 'success'
              ? 'bg-green-50 text-green-700'
              : status === 'error'
                ? 'bg-red-50 text-red-700'
                : 'bg-blue-50 text-blue-700'
          }`}
        >
          {message}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="rounded-[8px] bg-[var(--accent)] px-5 py-3 font-semibold text-white"
          >
            로그인
          </Link>
          <Link
            href="/signup"
            className="rounded-[8px] border border-[var(--border-soft)] px-5 py-3 font-semibold"
          >
            회원가입
          </Link>
        </div>
      </div>
    </FeatureShell>
  );
}

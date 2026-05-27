'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiRequest, ApiError } from '@/lib/api';
import { FeatureShell } from '@/components/feature-shell';
import { saveAuth, type LoginResponse } from '@/lib/auth';
import { loginSchema, type LoginFormValues } from '@/lib/validators';

export default function LoginPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');
  const [registered, setRegistered] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState(false);
  const [signupEmail, setSignupEmail] = useState('');
  const [resendMessage, setResendMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRegistered(params.get('registered') === '1');
    setVerifyEmail(params.get('verifyEmail') === '1');
    setSignupEmail(params.get('email') ?? '');
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitError('');

    try {
      const result = await apiRequest<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(values),
      });

      saveAuth(result);
      router.push('/');
    } catch (error) {
      setSubmitError(
        error instanceof ApiError ? error.message : '로그인에 실패했습니다.',
      );
    }
  };

  const handleResendVerification = async () => {
    setSubmitError('');
    setResendMessage('');

    if (!signupEmail) {
      setSubmitError('인증 메일을 다시 받을 Gmail 주소를 입력해 주세요.');
      return;
    }

    try {
      const result = await apiRequest<{ message: string }>(
        '/auth/resend-verification',
        {
          method: 'POST',
          body: JSON.stringify({ email: signupEmail }),
        },
      );
      setResendMessage(result.message);
    } catch (error) {
      setSubmitError(
        error instanceof ApiError
          ? error.message
          : '인증 메일을 다시 보내지 못했습니다.',
      );
    }
  };

  return (
    <FeatureShell
      eyebrow="Login"
      title="회원 로그인"
      description="로그인하면 게시판, 자료실, AI 준비 기능을 바로 이용할 수 있습니다."
    >
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.75fr]">
        <div className="rounded-[28px] bg-white p-8 shadow-[0_18px_50px_rgba(16,36,61,0.07)]">
          {registered ? (
            <p className="mb-5 rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-700">
              회원가입이 완료되었습니다. 방금 만든 계정으로 로그인해 주세요.
            </p>
          ) : null}
          {verifyEmail ? (
            <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 text-sm leading-6 text-blue-800">
              <p className="font-semibold">인증 메일을 보냈습니다.</p>
              <p className="mt-1">Gmail 받은편지함에서 인증 링크를 누른 뒤 로그인해 주세요.</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  type="email"
                  value={signupEmail}
                  onChange={(event) => setSignupEmail(event.target.value)}
                  placeholder="yourname@gmail.com"
                  className="min-w-0 flex-1 rounded-xl border border-blue-100 bg-white px-3 py-2 text-[var(--text-main)]"
                />
                <button
                  type="button"
                  onClick={() => void handleResendVerification()}
                  className="rounded-xl bg-[var(--accent)] px-4 py-2 font-semibold text-white"
                >
                  인증 메일 재발송
                </button>
              </div>
              {resendMessage ? (
                <p className="mt-2 text-blue-700">{resendMessage}</p>
              ) : null}
            </div>
          ) : null}

          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">이메일</span>
              <input
                {...register('email')}
                type="email"
                placeholder="yourname@gmail.com"
                className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--card-soft)] px-4 py-3"
              />
              {errors.email?.message ? (
                <p className="mt-2 text-sm text-red-600">{errors.email.message}</p>
              ) : null}
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold">비밀번호</span>
              <input
                {...register('password')}
                type="password"
                placeholder="1234abcd!!"
                className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--card-soft)] px-4 py-3"
              />
              {errors.password?.message ? (
                <p className="mt-2 text-sm text-red-600">{errors.password.message}</p>
              ) : null}
            </label>

            {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}

            <button
              className="w-full rounded-2xl bg-[var(--card-strong)] px-4 py-3 font-semibold text-white shadow-[0_14px_30px_rgba(16,36,61,0.18)] disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <p className="mt-6 text-sm text-[var(--text-muted)]">
            계정이 없다면 <Link className="font-semibold text-[var(--accent)]" href="/signup">회원가입</Link>
          </p>

          <div className="mt-8 border-t border-[var(--border-soft)] pt-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
              Social Login
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled
                className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-center font-semibold text-yellow-900 opacity-70"
              >
                Kakao 준비중
              </button>
              <button
                type="button"
                disabled
                className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center font-semibold text-emerald-900 opacity-70"
              >
                Naver 준비중
              </button>
            </div>
            <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">
              소셜 로그인은 배포 환경 연동 준비 중입니다. 현재는 이메일 로그인을 이용해 주세요.
            </p>
          </div>
        </div>

        <div className="rounded-[28px] bg-[var(--card-strong)] p-7 text-white">
          <h2 className="text-xl font-bold">로그인 후 열리는 메뉴</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-white/78">
            <li>게시판 글 목록과 본문, 댓글</li>
            <li>자료실 목록, 상세 정보, 파일 다운로드</li>
            <li>마이페이지의 내 활동과 저장 리포트</li>
            <li>AI 자기소개서와 면접 준비 기능</li>
          </ul>
        </div>
      </div>
    </FeatureShell>
  );
}

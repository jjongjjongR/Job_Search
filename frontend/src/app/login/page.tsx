'use client';

import Link from 'next/link';
import { signIn } from 'next-auth/react';
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRegistered(params.get('registered') === '1');
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
      router.push('/me');
    } catch (error) {
      setSubmitError(
        error instanceof ApiError ? error.message : '로그인에 실패했습니다.',
      );
    }
  };

  return (
    <FeatureShell
      eyebrow="Login"
      title="회원 로그인"
      description="로그인 후에만 게시판 본문, 댓글, 자료실 문서 내용을 볼 수 있도록 실제 사이트 흐름에 맞춰 보호했습니다."
    >
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.75fr]">
        <div className="rounded-[28px] bg-white p-8 shadow-[0_18px_50px_rgba(16,36,61,0.07)]">
          {registered ? (
            <p className="mb-5 rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-700">
              회원가입이 완료되었습니다. 방금 만든 계정으로 로그인해 주세요.
            </p>
          ) : null}

          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">이메일</span>
              <input
                {...register('email')}
                type="email"
                placeholder="test@example.com"
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
                onClick={() => signIn('kakao', { callbackUrl: '/social/callback' })}
                className="rounded-2xl bg-[#FEE500] px-4 py-3 text-center font-semibold text-[#191600]"
              >
                Kakao 로그인
              </button>
              <button
                type="button"
                onClick={() => signIn('naver', { callbackUrl: '/social/callback' })}
                className="rounded-2xl bg-[#03C75A] px-4 py-3 text-center font-semibold text-white"
              >
                Naver 로그인
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] bg-[var(--card-strong)] p-7 text-white">
          <h2 className="text-xl font-bold">로그인 후 열리는 메뉴</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-white/78">
            <li>게시판 글 목록과 본문, 댓글</li>
            <li>자료실 목록, 상세 정보, 파일 다운로드</li>
            <li>내 정보 및 마이페이지</li>
            <li>JWT 보호 API 기반 사용자 흐름</li>
          </ul>
        </div>
      </div>
    </FeatureShell>
  );
}

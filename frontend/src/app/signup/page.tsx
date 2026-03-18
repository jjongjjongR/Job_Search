'use client';

import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiRequest, ApiError } from '@/lib/api';
import { FeatureShell } from '@/components/feature-shell';
import { signupSchema, type SignupFormValues } from '@/lib/validators';

export default function SignupPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (values: SignupFormValues) => {
    setSubmitError('');
    setSuccessMessage('');

    try {
      await apiRequest('/auth/signup', {
        method: 'POST',
        body: JSON.stringify(values),
      });

      setSuccessMessage('회원가입이 완료되었습니다. 이제 로그인할 수 있습니다.');
      router.push('/login?registered=1');
    } catch (error) {
      setSubmitError(
        error instanceof ApiError ? error.message : '회원가입에 실패했습니다.',
      );
    }
  };

  return (
    <FeatureShell
      eyebrow="Signup"
      title="회원가입"
      description="가입 후 로그인하면 회원 전용 게시판과 자료실을 사용할 수 있습니다."
    >
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[28px] bg-white p-8 shadow-[0_18px_50px_rgba(16,36,61,0.07)]">
          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <FormField
              label="이메일"
              name="email"
              type="email"
              placeholder="test@example.com"
              register={register}
              error={errors.email?.message}
            />
            <FormField
              label="username"
              name="username"
              placeholder="jongheon"
              register={register}
              error={errors.username?.message}
            />
            <FormField
              label="displayName"
              name="displayName"
              placeholder="이종헌"
              register={register}
              error={errors.displayName?.message}
            />
            <FormField
              label="비밀번호"
              name="password"
              type="password"
              placeholder="1234abcd!!"
              register={register}
              error={errors.password?.message}
            />

            {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}
            {successMessage ? (
              <p className="text-sm text-green-700">{successMessage}</p>
            ) : null}

            <button
              className="w-full rounded-2xl bg-[var(--accent)] px-4 py-3 font-semibold text-white shadow-[0_12px_28px_rgba(30,111,217,0.28)] disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? '가입 중...' : '회원가입'}
            </button>
          </form>

          <p className="mt-6 text-sm text-[var(--text-muted)]">
            이미 계정이 있다면 <Link className="font-semibold text-[var(--accent)]" href="/login">로그인</Link>
          </p>

          <div className="mt-8 border-t border-[var(--border-soft)] pt-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
              Social Signup
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => signIn('kakao', { callbackUrl: '/social/callback' })}
                className="rounded-2xl bg-[#FEE500] px-4 py-3 text-center font-semibold text-[#191600]"
              >
                Kakao로 시작하기
              </button>
              <button
                type="button"
                onClick={() => signIn('naver', { callbackUrl: '/social/callback' })}
                className="rounded-2xl bg-[#03C75A] px-4 py-3 text-center font-semibold text-white"
              >
                Naver로 시작하기
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--border-soft)] bg-[var(--card-soft)] p-7">
          <h2 className="text-xl font-bold">가입 후 사용할 수 있는 기능</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--text-muted)]">
            <li>게시판 글 작성과 댓글 참여</li>
            <li>자료실 목록 확인과 파일 다운로드</li>
            <li>보호 API 기반 내 정보 조회</li>
            <li>추후 AI 자소서와 AI 면접 기능 연동</li>
          </ul>
        </div>
      </div>
    </FeatureShell>
  );
}

type FormFieldProps = {
  label: string;
  name: keyof SignupFormValues;
  type?: string;
  placeholder: string;
  register: ReturnType<typeof useForm<SignupFormValues>>['register'];
  error?: string;
};

function FormField({
  label,
  name,
  type = 'text',
  placeholder,
  register,
  error,
}: FormFieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      <input
        {...register(name)}
        type={type}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--card-soft)] px-4 py-3"
      />
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </label>
  );
}

'use client';

import Link from 'next/link';
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

      setSuccessMessage('인증 메일을 보냈습니다. Gmail 받은편지함을 확인해 주세요.');
      router.push(`/login?verifyEmail=1&email=${encodeURIComponent(values.email)}`);
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
      description="Gmail 주소로 가입한 뒤 이메일 인증을 완료하면 서비스를 이용할 수 있습니다."
    >
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[28px] bg-white p-8 shadow-[0_18px_50px_rgba(16,36,61,0.07)]">
          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <FormField
              label="이메일"
              name="email"
              type="email"
              placeholder="yourname@gmail.com"
              register={register}
              error={errors.email?.message}
            />
            <FormField
              label="아이디"
              name="username"
              placeholder="영문과 숫자로 입력"
              register={register}
              error={errors.username?.message}
            />
            <FormField
              label="이름"
              name="displayName"
              placeholder="서비스에 표시할 이름"
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
              소셜 가입은 배포 환경 연동 준비 중입니다. 현재는 이메일 가입을 이용해 주세요.
            </p>
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--border-soft)] bg-[var(--card-soft)] p-7">
          <h2 className="text-xl font-bold">가입 후 사용할 수 있는 기능</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--text-muted)]">
            <li>게시판 글 작성과 댓글 참여</li>
            <li>자료실 목록 확인과 파일 다운로드</li>
            <li>마이페이지에서 내 활동 확인</li>
            <li>AI 자소서와 AI 면접 준비</li>
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

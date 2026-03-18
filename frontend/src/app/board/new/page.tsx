'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FeatureShell } from '@/components/feature-shell';
import { apiRequest, ApiError } from '@/lib/api';
import { getStoredUser, type AuthUser } from '@/lib/auth';

export default function NewPostPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!user) {
      setErrorMessage('로그인 후 글을 작성할 수 있습니다.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await apiRequest('/posts', {
        method: 'POST',
        body: JSON.stringify({
          title,
          content,
          author: user.displayName,
        }),
      });
      router.push('/board');
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : '게시글 작성에 실패했습니다.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FeatureShell
      eyebrow="Board Write"
      title="새 게시글 작성"
      description="지금 로그인한 이름으로 게시글이 저장됩니다."
    >
      {user ? (
        <form
          onSubmit={handleSubmit}
          className="rounded-[28px] bg-white p-8 shadow-[0_18px_50px_rgba(16,36,61,0.07)]"
        >
          <div className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">제목</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--card-soft)] px-4 py-3"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">내용</span>
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                className="h-56 w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--card-soft)] px-4 py-3"
              />
            </label>
            {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-full bg-[var(--accent)] px-5 py-3 font-semibold text-white"
              >
                {isSubmitting ? '저장 중...' : '게시글 저장'}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="rounded-[28px] border border-[var(--border-soft)] bg-white p-8">
          <p className="text-[var(--text-muted)]">글 작성은 로그인 후 사용할 수 있습니다.</p>
          <Link className="mt-4 inline-block font-semibold text-[var(--accent)]" href="/login">
            로그인하러 가기
          </Link>
        </div>
      )}
    </FeatureShell>
  );
}

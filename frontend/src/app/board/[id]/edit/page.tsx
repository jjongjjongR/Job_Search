'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FeatureShell } from '@/components/feature-shell';
import { apiRequest, ApiError } from '@/lib/api';
import { getStoredUser, type AuthUser } from '@/lib/auth';

type PostDetail = {
  id: number;
  title: string;
  content: string;
  author: string;
};

export default function EditPostPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [post, setPost] = useState<PostDetail | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const postId = Number(params.id);

  useEffect(() => {
    setUser(getStoredUser());

    const loadPost = async () => {
      try {
        const data = await apiRequest<PostDetail>(`/posts/${postId}`);
        setPost(data);
        setTitle(data.title);
        setContent(data.content);
      } catch (error) {
        setErrorMessage(
          error instanceof ApiError ? error.message : '게시글을 불러오지 못했습니다.',
        );
      }
    };

    if (!Number.isNaN(postId)) {
      void loadPost();
    }
  }, [postId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await apiRequest(`/posts/${postId}`, {
      method: 'PUT',
      body: JSON.stringify({ title, content }),
    });
    router.push(`/board/${postId}`);
  };

  const canEdit = !!user && !!post && user.displayName === post.author;

  return (
    <FeatureShell
      eyebrow="Board Edit"
      title="게시글 수정"
      description="작성자 본인만 수정할 수 있습니다."
    >
      {!post && !errorMessage ? <div className="rounded-[28px] bg-white p-8">loading...</div> : null}
      {errorMessage ? <div className="rounded-[28px] bg-white p-8 text-red-600">{errorMessage}</div> : null}
      {post && canEdit ? (
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
            <div className="flex justify-end gap-3">
              <Link className="rounded-full border border-[var(--border-soft)] px-4 py-2 font-semibold" href={`/board/${postId}`}>
                취소
              </Link>
              <button className="rounded-full bg-[var(--accent)] px-4 py-2 font-semibold text-white" type="submit">
                수정 저장
              </button>
            </div>
          </div>
        </form>
      ) : null}
      {post && !canEdit ? (
        <div className="rounded-[28px] bg-white p-8">
          <p className="text-[var(--text-muted)]">작성자만 수정할 수 있습니다.</p>
        </div>
      ) : null}
    </FeatureShell>
  );
}

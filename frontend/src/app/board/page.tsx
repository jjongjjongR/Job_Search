'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FeatureShell } from '@/components/feature-shell';
import { LoginRequiredCard } from '@/components/login-required-card';
import { apiRequest } from '@/lib/api';
import { getStoredUser, type AuthUser } from '@/lib/auth';

type PostItem = {
  id: number;
  title: string;
  author: string;
  content: string;
  likes: number;
  views: number;
  createdAt: string;
};

const SORT_OPTIONS = [
  { value: 'latest', label: '최신순' },
  { value: 'likes', label: '좋아요순' },
  { value: 'views', label: '조회수순' },
] as const;

export default function BoardPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] =
    useState<(typeof SORT_OPTIONS)[number]['value']>('latest');

  useEffect(() => {
    const currentUser = getStoredUser();
    setUser(currentUser);
  }, []);

  useEffect(() => {
    const currentUser = getStoredUser();
    if (!currentUser) {
      setIsLoading(false);
      return;
    }

    const loadPosts = async () => {
      try {
        const data = await apiRequest<PostItem[]>(`/posts?sortBy=${sortBy}`);
        setPosts(data);
      } finally {
        setIsLoading(false);
      }
    };

    void loadPosts();
  }, [sortBy]);

  return (
    <FeatureShell
      eyebrow="Board"
      title="커뮤니티 게시판"
      description="로그인한 사용자는 글과 댓글을 작성할 수 있고, 모든 사용자는 현재 올라온 게시글 목록을 볼 수 있습니다."
    >
      {!user ? (
        <LoginRequiredCard
          title="게시판은 로그인한 회원만 볼 수 있습니다"
          description="게시글 목록과 본문, 댓글은 회원 전용 콘텐츠입니다. 로그인 후 전체 내용을 확인해 주세요."
        />
      ) : (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-[28px] bg-white p-6 shadow-[0_18px_50px_rgba(16,36,61,0.07)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">최근 게시글</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              면접 준비, 자소서, 취업 정보 같은 내용을 자유롭게 공유할 수 있습니다.
            </p>
          </div>
          <button
            onClick={() => router.push('/board/new')}
            className="rounded-full bg-[var(--accent)] px-5 py-3 font-semibold text-white shadow-[0_12px_28px_rgba(30,111,217,0.28)]"
          >
            새 글 작성
          </button>
        </div>

        <div className="flex items-center justify-between rounded-[24px] bg-white px-5 py-4 shadow-[0_10px_30px_rgba(16,36,61,0.05)]">
          <p className="text-sm font-semibold text-[var(--text-muted)]">정렬 기준</p>
          <div className="flex gap-2">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setSortBy(option.value)}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  sortBy === option.value
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--card-soft)] text-[var(--text-muted)]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          {isLoading ? <p>게시글을 불러오는 중...</p> : null}
          {!isLoading && posts.length === 0 ? (
            <div className="rounded-[28px] border border-[var(--border-soft)] bg-white p-8 text-[var(--text-muted)]">
              아직 게시글이 없습니다. 첫 글을 작성해 보세요.
            </div>
          ) : null}

          {posts.map((post) => (
            <button
              key={post.id}
              onClick={() => router.push(`/board/${post.id}`)}
              className="rounded-[28px] border border-[var(--border-soft)] bg-white p-6 text-left shadow-[0_16px_40px_rgba(16,36,61,0.05)] transition hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold">{post.title}</h3>
                  <p className="mt-2 text-sm text-[var(--text-muted)]">작성자: {post.author}</p>
                </div>
                <span className="rounded-full bg-[var(--card-soft)] px-3 py-2 text-xs font-semibold text-[var(--accent)]">
                  #{post.id}
                </span>
              </div>
              <p className="mt-4 line-clamp-2 text-sm leading-6 text-[var(--text-muted)]">
                {post.content}
              </p>
              <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-[var(--text-muted)]">
                <span>좋아요 {post.likes}</span>
                <span>조회수 {post.views}</span>
                <span>{new Date(post.createdAt).toLocaleDateString()}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
      )}
    </FeatureShell>
  );
}

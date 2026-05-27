'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { clearAuth, getAccessToken, getStoredUser, type AuthUser } from '@/lib/auth';

type PostItem = {
  id: number;
  title: string;
  author: string;
  content: string;
  likes: number;
  views: number;
  createdAt: string;
};

export default function HomePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [popularPosts, setPopularPosts] = useState<PostItem[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);

  useEffect(() => {
    const currentUser = getStoredUser();
    const token = getAccessToken();
    setUser(currentUser);

    if (!currentUser || !token) {
      return;
    }

    const loadPopularPosts = async () => {
      setIsLoadingPosts(true);
      try {
        const posts = await apiRequest<PostItem[]>('/posts?sortBy=likes');
        setPopularPosts(posts.slice(0, 3));
      } finally {
        setIsLoadingPosts(false);
      }
    };

    void loadPopularPosts();
  }, []);

  const handleLogout = () => {
    clearAuth();
    setUser(null);
    setPopularPosts([]);
    window.location.href = '/login';
  };

  return (
    <section className="py-6">
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[8px] border border-[var(--border-soft)] bg-white p-8 shadow-[0_24px_70px_rgba(16,36,61,0.08)] lg:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
            World Job Search
          </p>
          <h1 className="mt-4 max-w-2xl text-3xl font-bold leading-tight [word-break:keep-all] sm:text-4xl">
            취업 준비를 한 곳에서 이어가는 온세상이취업
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--text-muted)]">
            공고를 살펴보고, 필요한 자료를 찾고, 자기소개서와 면접을 점검할 수 있는
            취업 준비 서비스입니다. 커뮤니티를 통해 경험을 나누고 마이페이지에서 내 활동과
            AI 리포트를 다시 확인할 수 있습니다.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <FeaturePoint title="커뮤니티" description="질문과 경험 공유" />
            <FeaturePoint title="자료실" description="준비 자료 열람" />
            <FeaturePoint title="AI 준비" description="자소서와 면접 점검" />
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {user ? (
              <>
                <Link className="rounded-[8px] bg-[var(--accent)] px-5 py-3 font-semibold text-white shadow-[0_12px_28px_rgba(30,111,217,0.22)]" href="/mypage">
                  마이페이지
                </Link>
                <button
                  className="rounded-[8px] border border-[var(--border-soft)] bg-white px-5 py-3 font-semibold"
                  onClick={handleLogout}
                >
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <Link className="rounded-[8px] bg-[var(--accent)] px-5 py-3 font-semibold text-white shadow-[0_12px_28px_rgba(30,111,217,0.22)]" href="/signup">
                  회원가입
                </Link>
                <Link className="rounded-[8px] border border-[var(--border-soft)] bg-white px-5 py-3 font-semibold" href="/login">
                  로그인
                </Link>
              </>
            )}
          </div>
        </section>

        <aside className="rounded-[8px] border border-[var(--border-soft)] bg-[var(--card-strong)] p-7 text-white shadow-[0_24px_70px_rgba(16,36,61,0.1)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/65">
                Popular Board
              </p>
              <h2 className="mt-3 text-2xl font-bold [word-break:keep-all]">
                좋아요가 많은 게시글
              </h2>
            </div>
            <Link
              href="/board"
              className="rounded-[8px] border border-white/18 px-3 py-2 text-sm font-semibold"
            >
              게시판
            </Link>
          </div>

          <div className="mt-6 space-y-3">
            {!user ? (
              <div className="rounded-[8px] border border-white/14 bg-white/7 p-5 leading-7 text-white/76">
                로그인하면 게시판에서 좋아요를 많이 받은 글 3개를 여기서 바로 확인할 수 있습니다.
              </div>
            ) : null}

            {user && isLoadingPosts ? (
              <div className="rounded-[8px] border border-white/14 bg-white/7 p-5 text-white/76">
                게시글을 불러오는 중입니다.
              </div>
            ) : null}

            {user && !isLoadingPosts && popularPosts.length === 0 ? (
              <div className="rounded-[8px] border border-white/14 bg-white/7 p-5 text-white/76">
                아직 표시할 게시글이 없습니다.
              </div>
            ) : null}

            {popularPosts.map((post, index) => (
              <Link
                key={post.id}
                href={`/board/${post.id}`}
                className="block rounded-[8px] border border-white/14 bg-white/7 p-5 transition hover:bg-white/12"
              >
                <div className="flex items-center justify-between gap-3 text-sm text-white/64">
                  <span>TOP {index + 1}</span>
                  <span>좋아요 {post.likes}</span>
                </div>
                <h3 className="mt-3 text-lg font-bold [word-break:keep-all]">
                  {post.title}
                </h3>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/70">
                  {post.content}
                </p>
              </Link>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

function FeaturePoint({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[8px] border border-[var(--border-soft)] bg-[var(--card-soft)] p-4">
      <h2 className="font-bold">{title}</h2>
      <p className="mt-2 text-sm text-[var(--text-muted)]">{description}</p>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FeatureShell } from '@/components/feature-shell';
import { apiRequest } from '@/lib/api';
import { getStoredUser, type AuthUser } from '@/lib/auth';

type PostSummary = {
  id: number;
  title: string;
  author: string;
  likes: number;
  views: number;
  createdAt: string;
};

export default function MyPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [myPosts, setMyPosts] = useState<PostSummary[]>([]);
  const [likedPosts, setLikedPosts] = useState<PostSummary[]>([]);

  useEffect(() => {
    const currentUser = getStoredUser();
    setUser(currentUser);

    if (!currentUser) {
      return;
    }

    const loadMyPageData = async () => {
      const [authored, liked] = await Promise.all([
        apiRequest<PostSummary[]>('/posts/me/authored'),
        apiRequest<PostSummary[]>('/posts/me/liked'),
      ]);

      setMyPosts(authored);
      setLikedPosts(liked);
    };

    void loadMyPageData();
  }, []);

  return (
    <FeatureShell
      eyebrow="My Page"
      title="내 계정 정보"
      description="현재 로그인한 사용자의 기본 정보를 확인하고, 게시판과 자료실로 바로 이동할 수 있습니다."
    >
      {user ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-[28px] bg-white p-8 shadow-[0_18px_50px_rgba(16,36,61,0.07)]">
            <div className="space-y-4 rounded-[28px] bg-[var(--card-soft)] p-6">
              <InfoRow label="이름" value={user.displayName} />
              <InfoRow label="이메일" value={user.email} />
              <InfoRow label="username" value={user.username} />
              <InfoRow label="권한" value={user.role} />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <PostListCard
                title="내가 쓴 글"
                emptyMessage="작성한 게시글이 없습니다."
                posts={myPosts}
              />
              <PostListCard
                title="내가 좋아요한 글"
                emptyMessage="좋아요한 게시글이 없습니다."
                posts={likedPosts}
              />
            </div>
          </div>

          <div className="rounded-[28px] bg-[var(--card-strong)] p-7 text-white">
            <h2 className="text-xl font-bold">바로가기</h2>
            <div className="mt-4 flex flex-col gap-3">
              <Link className="rounded-2xl border border-white/20 px-4 py-3 font-semibold" href="/board">
                게시판 보러 가기
              </Link>
              <Link className="rounded-2xl border border-white/20 px-4 py-3 font-semibold" href="/dataroom">
                자료실 보러 가기
              </Link>
              <Link className="rounded-2xl border border-white/20 px-4 py-3 font-semibold" href="/me">
                보호 API 확인하기
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-[28px] border border-[var(--border-soft)] bg-white p-8">
          <p className="text-[var(--text-muted)]">먼저 로그인해 주세요.</p>
          <Link className="mt-4 inline-block font-semibold text-[var(--accent)]" href="/login">
            로그인 페이지로 이동
          </Link>
        </div>
      )}
    </FeatureShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-2xl bg-white px-4 py-3 sm:grid-cols-[120px_1fr]">
      <span className="text-sm font-semibold text-[var(--text-muted)]">{label}</span>
      <span className="break-all">{value}</span>
    </div>
  );
}

function PostListCard({
  title,
  emptyMessage,
  posts,
}: {
  title: string;
  emptyMessage: string;
  posts: PostSummary[];
}) {
  return (
    <div className="rounded-[28px] border border-[var(--border-soft)] bg-white p-5">
      <h3 className="text-lg font-bold">{title}</h3>
      <div className="mt-4 space-y-3">
        {posts.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">{emptyMessage}</p>
        ) : null}
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/board/${post.id}`}
            className="block rounded-2xl bg-[var(--card-soft)] px-4 py-3"
          >
            <p className="font-semibold">{post.title}</p>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              좋아요 {post.likes} · 조회수 {post.views}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

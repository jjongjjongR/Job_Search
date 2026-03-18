'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { FeatureShell } from '@/components/feature-shell';
import { LoginRequiredCard } from '@/components/login-required-card';
import { apiRequest } from '@/lib/api';
import { getStoredUser, type AuthUser } from '@/lib/auth';
import { isAdmin } from '@/lib/isAdmin';

type PostDetail = {
  id: number;
  title: string;
  content: string;
  author: string;
  likes: number;
  views: number;
  createdAt: string;
};

type CommentItem = {
  id: number;
  content: string;
  author: string;
  postId: number;
};

export default function PostDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [post, setPost] = useState<PostDetail | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentContent, setCommentContent] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const postId = Number(params.id);

  const loadPost = useCallback(async () => {
    const data = await apiRequest<PostDetail>(`/posts/${postId}`);
    setPost(data);
  }, [postId]);

  const loadComments = useCallback(async () => {
    const data = await apiRequest<CommentItem[]>(`/comments?postId=${postId}`);
    setComments(data);
  }, [postId]);

  useEffect(() => {
    const currentUser = getStoredUser();
    setUser(currentUser);
    if (currentUser && !Number.isNaN(postId)) {
      void loadPost();
      void loadComments();
    }
  }, [loadComments, loadPost, postId]);

  const handleDeletePost = async () => {
    if (!window.confirm('정말 삭제하시겠습니까?')) {
      return;
    }

    await apiRequest(`/posts/${postId}`, { method: 'DELETE' });
    router.push('/board');
  };

  const handleCreateComment = async () => {
    if (!user || !commentContent.trim()) {
      return;
    }

    await apiRequest('/comments', {
      method: 'POST',
      body: JSON.stringify({
        postId,
        author: user.displayName,
        content: commentContent,
      }),
    });

    setCommentContent('');
    await loadComments();
  };

  const handleUpdateComment = async () => {
    if (!editingCommentId) {
      return;
    }

    await apiRequest(`/comments/${editingCommentId}`, {
      method: 'PUT',
      body: JSON.stringify({
        content: editContent,
        author: user?.displayName ?? '',
      }),
    });

    setEditingCommentId(null);
    setEditContent('');
    await loadComments();
  };

  const handleDeleteComment = async (commentId: number) => {
    setComments((prev) => prev.filter((comment) => comment.id !== commentId));
    await apiRequest(`/comments/${commentId}`, {
      method: 'DELETE',
    });
  };

  const handleStartEdit = (comment: CommentItem) => {
    setEditingCommentId(comment.id);
    setEditContent(comment.content);
  };

  const handleLikePost = async () => {
    const updatedPost = await apiRequest<PostDetail>(`/posts/${postId}/like`, {
      method: 'POST',
    });
    setPost(updatedPost);
  };

  if (!post) {
    return (
      <FeatureShell
        eyebrow="Board Detail"
        title="게시글을 불러오는 중"
        description="잠시만 기다려 주세요."
      >
        {!user ? (
          <LoginRequiredCard
            title="게시글 본문은 로그인 후 볼 수 있습니다"
            description="회원이 아니면 게시글 내용과 댓글을 확인할 수 없습니다."
          />
        ) : (
          <div className="rounded-[28px] bg-white p-8">loading...</div>
        )}
      </FeatureShell>
    );
  }

  const canManagePost =
    !!user && (user.displayName === post.author || isAdmin(user));

  return (
    <FeatureShell
      eyebrow="Board Detail"
      title={post.title}
      description="게시글 내용과 댓글을 한 화면에서 확인할 수 있습니다."
    >
      <div className="space-y-6">
        <div className="rounded-[28px] bg-white p-8 shadow-[0_18px_50px_rgba(16,36,61,0.07)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-[var(--text-muted)]">작성자: {post.author}</p>
              <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-[var(--text-muted)]">
                <span>좋아요 {post.likes}</span>
                <span>조회수 {post.views}</span>
                <span>{new Date(post.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
            <button
              onClick={() => void handleLikePost()}
              className="rounded-full bg-[var(--card-soft)] px-4 py-2 font-semibold text-[var(--accent)]"
            >
              좋아요
            </button>
          </div>

          <p className="mt-6 whitespace-pre-wrap leading-8">{post.content}</p>

          {canManagePost ? (
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => router.push(`/board/${post.id}/edit`)}
                className="rounded-full border border-[var(--border-soft)] px-4 py-2 font-semibold"
              >
                수정
              </button>
              <button
                onClick={() => void handleDeletePost()}
                className="rounded-full bg-[#c94a4a] px-4 py-2 font-semibold text-white"
              >
                삭제
              </button>
            </div>
          ) : null}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.8fr]">
          <div className="rounded-[28px] bg-white p-8 shadow-[0_18px_50px_rgba(16,36,61,0.07)]">
            <h2 className="text-xl font-bold">댓글</h2>
            <div className="mt-5 space-y-4">
              {comments.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">댓글이 없습니다.</p>
              ) : null}

              {comments.map((comment) => {
                const canManageComment =
                  !!user &&
                  (user.displayName === comment.author || isAdmin(user));

                return (
                  <div
                    key={comment.id}
                    className="rounded-[24px] border border-[var(--border-soft)] bg-[var(--card-soft)] p-5"
                  >
                    {editingCommentId === comment.id ? (
                      <>
                        <textarea
                          value={editContent}
                          onChange={(event) => setEditContent(event.target.value)}
                          className="h-28 w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3"
                        />
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => void handleUpdateComment()}
                            className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
                          >
                            저장
                          </button>
                          <button
                            onClick={() => setEditingCommentId(null)}
                            className="rounded-full border border-[var(--border-soft)] px-4 py-2 text-sm font-semibold"
                          >
                            취소
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white font-bold text-[var(--accent)]">
                              {comment.author.slice(0, 1)}
                            </div>
                            <div>
                              <p className="font-semibold">{comment.author}</p>
                              <p className="mt-2 leading-7">{comment.content}</p>
                            </div>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[var(--text-muted)]">
                            댓글
                          </span>
                        </div>
                        {canManageComment ? (
                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => handleStartEdit(comment)}
                              className="text-sm font-semibold text-[var(--accent)]"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => void handleDeleteComment(comment.id)}
                              className="text-sm font-semibold text-[#c94a4a]"
                            >
                              삭제
                            </button>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[28px] bg-[var(--card-strong)] p-7 text-white">
            <h2 className="text-xl font-bold">댓글 작성</h2>
            {user ? (
              <>
                <textarea
                  rows={8}
                  className="mt-4 w-full rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-white placeholder:text-white/55"
                  placeholder="댓글을 입력하세요."
                  value={commentContent}
                  onChange={(event) => setCommentContent(event.target.value)}
                />
                <p className="mt-3 text-sm text-white/70">
                  {user.displayName} 이름으로 댓글이 등록됩니다.
                </p>
                <button
                  onClick={() => void handleCreateComment()}
                  className="mt-4 rounded-full bg-white px-4 py-2 font-semibold text-[var(--card-strong)]"
                >
                  댓글 작성
                </button>
              </>
            ) : (
              <div className="mt-4 text-sm leading-6 text-white/78">
                댓글 작성은 로그인 후 가능합니다.
                <Link className="mt-3 block font-semibold text-white" href="/login">
                  로그인하러 가기
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </FeatureShell>
  );
}

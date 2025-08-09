// src/app/board/[id]/page.tsx

"use client";

import axios from "axios";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isAdmin } from "@/lib/isAdmin";

const api = axios.create({
  baseURL: "http://localhost:3001",
});

type Post = {
  id: number;
  title: string;
  content: string;
  author: string;
};

type Comment = {
  id: number;
  content: string;
  author: string;
  postId: number;
};

export default function PostDetail() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const postId = params.id;

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentContent, setCommentContent] = useState("");

  const [editingComment, setEditingComment] = useState<Comment | null>(null);
  const [editContent, setEditContent] = useState("");

  useEffect(() => {
    async function fetchPost() {
      try {
        const response = await api.get<Post>(`/posts/${postId}`);
        setPost(response.data);
      } catch (error) {
        console.error("게시글을 불러오는 데 실패했습니다.", error);
      }
    }
    if (postId) fetchPost();
  }, [postId]);

  useEffect(() => {
    async function fetchComments() {
      try {
        const response = await api.get<Comment[]>(`/comments?postId=${postId}`);
        setComments(response.data);
      } catch (error) {
        console.error("댓글을 불러오는 데 실패했습니다.", error);
      }
    }
    if (postId) fetchComments();
  }, [postId]);

  const handleDeletePost = async () => {
    if (!window.confirm("정말 삭제하시겠습니까?")) return;
    try {
      await api.delete(`/posts/${postId}`);
      router.push("/board");
    } catch (error) {
      console.error("게시글 삭제 실패:", error);
    }
  };

  const handleCommentSubmit = async () => {
    if (!commentContent.trim()) return alert("댓글 내용을 입력하세요.");
    if (!session?.user?.name) return alert("로그인이 필요합니다.");

    try {
      await api.post("/comments", {
        content: commentContent,
        author: session.user.name,
        postId: Number(postId),
      });
      setCommentContent("");
      const response = await api.get<Comment[]>(`/comments?postId=${postId}`);
      setComments(response.data);
    } catch (error) {
      console.error("댓글 작성 실패:", error);
    }
  };

  const handleEditClick = (comment: Comment) => {
    setEditingComment(comment);
    setEditContent(comment.content);
  };

  const handleEditSubmit = async () => {
    if (!editingComment) return;
    try {
      await api.put(`/comments/${editingComment.id}`, {
        content: editContent,
        author: session?.user?.name,
      });
      setEditingComment(null);
      setEditContent("");
      const response = await api.get<Comment[]>(`/comments?postId=${postId}`);
      setComments(response.data);
    } catch (error) {
      console.error("댓글 수정 실패:", error);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!confirm("댓글을 삭제하시겠습니까?")) return;
    try {
      await api.delete(`/comments/${commentId}`);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (error) {
      console.error("댓글 삭제 실패:", error);
    }
  };

  if (!post) return <p>loading...</p>;

  const canDelete = session && (session.user?.name === post.author || isAdmin(session));
  const canEdit = session && session.user?.name === post.author;

  return (
    <main className="max-w-2xl mx-auto p-6 bg-white shadow-lg rounded-lg">
      <h1 className="text-2xl font-bold">{post.title}</h1>
      <p className="text-gray-600 mb-4">작성자: {post.author}</p>
      <p className="border-t pt-4">{post.content}</p>

      <div className="flex gap-2 mt-4">
        {canEdit && (
          <button
            onClick={() => router.push(`/board/${post.id}/edit`)}
            className="p-2 bg-gray-500 text-white rounded"
          >
            수정
          </button>
        )}
        {canDelete && (
          <button
            onClick={handleDeletePost}
            className="p-2 bg-red-500 text-white rounded"
          >
            삭제
          </button>
        )}
      </div>

      {/* 댓글 리스트 */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-4">댓글</h2>
        {comments.length === 0 && <p className="text-gray-500">댓글이 없습니다.</p>}
        <ul className="space-y-4">
          {comments.map((comment) => (
            <li key={comment.id} className="border rounded p-3 bg-gray-50">
              {editingComment?.id === comment.id ? (
                <>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full p-2 border rounded"
                  />
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={handleEditSubmit}
                      className="text-green-600 text-sm"
                    >
                      저장
                    </button>
                    <button
                      onClick={() => setEditingComment(null)}
                      className="text-gray-600 text-sm"
                    >
                      취소
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p>{comment.content}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    작성자: {comment.author}
                  </p>
                  {(session?.user?.name === comment.author || isAdmin(session)) && (
                  <div className="flex gap-2 mt-2">
                  <button
                  onClick={() => handleEditClick(comment)}
                  className="text-blue-600 text-sm"
                  > 
                    수정
                  </button>
                  <button
                  onClick={() => handleDeleteComment(comment.id)}
                  className="text-red-600 text-sm"
                  >
                    삭제
                  </button>
                  </div>
                )}

                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* 댓글 작성 폼 */}
      {session?.user?.name && (
        <section className="mt-6">
          <textarea
            rows={3}
            className="w-full p-2 border rounded resize-none"
            placeholder="댓글을 입력하세요"
            value={commentContent}
            onChange={(e) => setCommentContent(e.target.value)}
          />
          <button
            onClick={handleCommentSubmit}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            댓글 작성
          </button>
        </section>
      )}
    </main>
  );
}

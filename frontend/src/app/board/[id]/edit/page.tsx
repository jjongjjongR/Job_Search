"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";

const api = axios.create({
  baseURL: "http://localhost:3001",
});

export default function EditPost() {
  const { data: session } = useSession();
  const router = useRouter();
  const { id } = useParams();
  const postId = Number(id);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [author, setAuthor] = useState("");

  useEffect(() => {
    async function fetchPost() {
      try {
        const response = await api.get(`/posts/${postId}`);
        setTitle(response.data.title);
        setContent(response.data.content);
        setAuthor(response.data.author);
      } catch (error) {
        console.error("게시글을 불러오는 데 실패했습니다.", error);
        alert("존재하지 않는 게시글입니다.");
        router.push("/board");
      }
    }

    if (postId) fetchPost();
  }, [postId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('PATCH 요청 전송:', { postId, title, content });
  
    try {
      await api.put(`/posts/${postId}`, { title, content });
      router.push(`/board/${postId}`);
    } catch (error: any) {
      console.error('게시글 수정 실패', error.response?.data || error);
      if (error.response?.status === 404) {
        alert("해당 게시글이 존재하지 않습니다.");
        router.push("/board");
      }
    }
  };
  

  if (!session) {
    return <p>로그인이 필요합니다.</p>;
  }

  if (session.user?.name !== author) {
    return <p>작성자만 수정할 수 있습니다.</p>;
  }

  return (
    <main className="max-w-3xl mx-auto p-6 bg-white shadow-lg rounded-lg">
      <h1 className="text-2xl font-bold mb-4 text-center">게시글 수정</h1>

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">
            제목
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div className="mb-4">
          <label htmlFor="content" className="block text-sm font-medium text-gray-700">
            내용
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded-lg shadow-md hover:bg-blue-600 transition"
          >
            수정
          </button>
        </div>
      </form>
    </main>
  );
}

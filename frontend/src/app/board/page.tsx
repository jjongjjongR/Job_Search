// src/app/board/page.tsx

"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";

const api = axios.create({
  baseURL: "http://localhost:3001",
});

type Post = {
  id: number;
  title: string;
  author: string;
};

export default function Board() {
  const [posts, setPosts] = useState<Post[]>([]);
  const router = useRouter();
  const { status } = useSession(); // session 제거, status만 사용
  const { data: session } = useSession();

  useEffect(() => {
    async function fetchPosts() {
      try {
        const response = await api.get<Post[]>("/posts");
        setPosts(response.data);
      } catch (error) {
        console.error("데이터를 불러오는 데 실패했습니다.", error);
      }
    }
    fetchPosts();
  }, []);

  if (status === "loading") {
    return <p className="text-center text-gray-500">로딩 중...</p>;
  }

  if (!session) {
    return (
      <main className="max-w-3xl mx-auto p-6 bg-white shadow-lg rounded-lg">
        <h1 className="text-2xl font-bold mb-4 text-center">
          <Link
            href="http://localhost:3000/api/auth/signin"
            className="text-blue-700 hover:underline"
          >
            로그인
          </Link>이 필요합니다.
        </h1>
        <p className="text-center">로그인 후 게시판을 이용할 수 있습니다.</p>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto p-6 bg-white shadow-lg rounded-lg">
      <h1 className="text-2xl font-bold mb-4 text-center">게시판</h1>

      <div className="flex justify-end mb-4">
        <button
          onClick={() => router.push("/board/new")}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg shadow-md hover:bg-blue-600 transition"
        >
          새 글 작성
        </button>
      </div>

      <ul className="space-y-4">
        {posts.map((post) => (
          <li
            key={post.id}
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-100 cursor-pointer transition"
            onClick={() => router.push(`/board/${post.id}`)}
          >
            <h2 className="text-lg font-semibold">{post.title}</h2>
            <p className="text-sm text-gray-600">작성자: {post.author}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}

// src/app/dataroom/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { isAdmin } from "@/lib/isAdmin";
import Link from "next/link";

type FilePost = {
  id: number;
  title: string;
  uploader: string;
  createdAt: string;
};

export default function DataRoom() {
  const [posts, setPosts] = useState<FilePost[]>([]);
  const router = useRouter();
  const { data: session } = useSession();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get<FilePost[]>("/api/files");
        setPosts(res.data);
      } catch (err) {
        console.error("자료 불러오기 실패", err);
      }
    };

    if (session) {
      fetchData();
    }
  }, [session]);

  // 로그인하지 않은 경우
  if (!session) {
    return (
      <main className="max-w-3xl mx-auto p-6 bg-white shadow-lg rounded-lg">
        <h1 className="text-2xl font-bold mb-4 text-center">
        <Link
          href="http://localhost:3000/api/auth/signin" // 로그인 경로에 맞게 수정
          className="text-blue-700 hover:underline"
        >
          로그인
        </Link>
        이 필요합니다.
      </h1>
        <p className="text-center">로그인 후 자료실을 이용할 수 있습니다.</p>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto p-6 bg-white shadow-lg rounded-lg">
      <h1 className="text-2xl font-bold mb-4 text-center">자료실</h1>

      {isAdmin(session) && (
        <div className="flex justify-end mb-4">
          <button
            onClick={() => router.push("/dataroom/new")}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg shadow-md hover:bg-blue-600 transition"
          >
            자료 업로드
          </button>
        </div>
      )}

      <ul className="space-y-4">
        {posts.map((post) => (
          <li
            key={post.id}
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-100 cursor-pointer transition"
            onClick={() => router.push(`/dataroom/${post.id}`)}
          >
            <h2 className="text-lg font-semibold">{post.title}</h2>
            <p className="text-sm text-gray-600">
              업로더: {post.uploader} |{" "}
              {new Date(post.createdAt).toLocaleDateString()}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}

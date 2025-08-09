// src/app/board/new/page.tsx

"use client";

import axios from "axios";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const api = axios.create({
    baseURL:"http://localhost:3001",
});

export default function NewPost() {
    const{data: session} = useSession();
    const router = useRouter();
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");

    if(!session) {
        return <p>로그인이 필요합니다.</p>
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!title.trim() || !content.trim()){
            alert("제목과 내용을 입력하세요.");
            return;
        }

        try {
            await api.post("/posts", {
                title, content,
                author: session.user?.name,
            });
            router.push("/board");
        }catch (error) {
            console.error("게시글 작성 실패: ", error);
        }
    };
    return (
        <main className="max-w-2xl mx-auto p-6 bg-white shadow-lg rounded-lg">
          <h1 className="text-2xl font-bold mb-4">새 글 작성</h1>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="text"
              placeholder="제목"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="p-2 border border-gray-300 rounded"
            />
            <textarea
              placeholder="내용"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="p-2 border border-gray-300 rounded h-40"
            />
            <button type="submit" className="p-2 bg-blue-500 text-white rounded">
              저장
            </button>
          </form>
        </main>
      );
}
// app/ai_cover_letter/page.tsx

"use client";

import { useState } from "react";
import axios from "axios";
import Link from "next/link";
import { useSession } from "next-auth/react";

export default function AICoverLetterPage() {
  const { data: session, status } = useSession();
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<null | {
    summary: string;
    issues: string[];
    suggestions: string[];
    raw?: string;
  }>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/feedback/cover-letter`,
        { content: input }
      );
      setFeedback(res.data);

      if (res.data.summary === "AI 응답 파싱 실패") {
        console.warn("🛠️ AI 원본 응답 (raw):", res.data.raw);
      }
    } catch (err) {
      alert("오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading") return null;

  if (!session) {
    return (
      <main className="max-w-2xl mx-auto p-8 bg-white rounded-xl shadow-md">
        <h1 className="text-2xl font-bold mb-4 text-center">
          <Link href="/api/auth/signin" className="text-blue-600 hover:underline">
            로그인
          </Link>
          이 필요합니다.
        </h1>
        <p className="text-center text-gray-600">
          로그인 후 자기소개서 분석 기능을 사용할 수 있습니다.
        </p>
      </main>
    );
  }

  return (
     <main className="min-h-screen py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-2xl p-10">
        <h1 className="text-4xl font-extrabold mb-8 text-center text-gray-900">
          AI 자기소개서 피드백
        </h1>

        <textarea
          className="w-full border border-gray-300 rounded-2xl p-5 h-52 resize-none
            focus:outline-none focus:ring-4 focus:ring-blue-400 transition-shadow text-gray-800 text-lg"
          placeholder="자기소개서를 여기에 입력하세요..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />

        <div className="mt-8 flex justify-center">
          <button
            className={`flex items-center justify-center gap-3 bg-blue-700 hover:bg-blue-800
              text-white font-semibold px-8 py-3 rounded-2xl shadow-lg transition
              disabled:opacity-50 disabled:cursor-not-allowed`}
            onClick={handleSubmit}
            disabled={loading || input.trim() === ""}
          >
            {loading ? (
              <svg
                className="animate-spin w-6 h-6 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                ></path>
              </svg>
            ) : null}
            {loading ? "분석 중..." : "AI 피드백 받기"}
          </button>
        </div>

        {feedback && (
          <div className="mt-12 space-y-8">
            <section className="bg-blue-50 rounded-xl p-6 shadow-inner border border-blue-200">
              <h2 className="text-2xl font-semibold mb-3 text-blue-700 border-b border-blue-300 pb-2">
                1. 총평
              </h2>
              <p className="text-gray-900 text-lg">{feedback.summary}</p>
            </section>

            <section className="bg-red-50 rounded-xl p-6 shadow-inner border border-red-200">
              <h2 className="text-2xl font-semibold mb-3 text-red-700 border-b border-red-300 pb-2">
                2. 문제점
              </h2>
              {feedback.issues.length > 0 ? (
                <ul className="list-disc list-inside text-red-800 space-y-1 text-lg">
                  {feedback.issues.map((issue, idx) => (
                    <li key={idx}>{issue}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 text-lg italic">없음</p>
              )}
            </section>

            <section className="bg-green-50 rounded-xl p-6 shadow-inner border border-green-200">
              <h2 className="text-2xl font-semibold mb-3 text-green-700 border-b border-green-300 pb-2">
                3. 개선된 예시문장
              </h2>
              {feedback.suggestions.length > 0 ? (
                <ul className="list-disc list-inside text-green-800 space-y-1 text-lg">
                  {feedback.suggestions.map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 text-lg italic">없음</p>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

"use client";

import { useRef, useState, useEffect } from "react";
import axios from "axios";

export default function InterviewPage() {
  const [history, setHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 엔터키 입력 시 전송 처리
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);

    // 높이 자동 조절
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"; // 높이 초기화
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px"; // 내용에 맞춰 조절
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    // 사용자의 입력을 history에 추가
    const newHistory = [...history, { role: "user" as "user", content: input }];
    setHistory(newHistory);

    setLoading(true);
    try {
      const res = await axios.post<{ reply: string; feedback: string | null }>(
        `${process.env.NEXT_PUBLIC_API_URL}/interview/next`,
        { history: newHistory }
      );

      // 피드백이 있으면 추가
      if (res.data.feedback) {
        setHistory((prev) => [...prev, { role: "assistant", content: `📝 피드백: ${res.data.feedback}` }]);
      }

      // AI 면접관 답변 추가
      setHistory((prev) => [...prev, { role: "assistant", content: res.data.reply }]);

    } catch (e) {
      alert("에러가 발생했습니다.");
    } finally {
      setLoading(false);
    }

    setInput(""); // 입력란 초기화
  };

  return (
    <main className="max-w-3xl mx-auto p-6 bg-gray-50 min-h-screen flex flex-col">
      <h1 className="text-3xl font-extrabold mb-6 text-gray-900 select-none">AI 면접 시뮬레이션</h1>

      <div
        ref={scrollRef}
        className="overflow-y-auto bg-white rounded-lg shadow-md p-6 mb-4 border border-gray-200"
        style={{ minHeight: 275, maxHeight: 500 }} // minHeight 축소, maxHeight 추가
      >
        {history.length === 0 && (
          <p className="text-gray-400 italic text-center mt-24 select-none">
            질문이나 답변을 입력해 면접을 시작하세요.
          </p>
        )}

        {history.map((msg, idx) => (
          <div
            key={idx}
            className={`mb-4 max-w-[80%] px-4 py-3 rounded-lg ${
              msg.role === "user"
                ? "ml-auto bg-blue-600 text-white rounded-tr-none"
                : "mr-auto bg-gray-200 text-gray-800 rounded-bl-none"
            }`}
          >
            <span className="whitespace-pre-wrap">{msg.content}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <textarea
          ref={textareaRef}
          rows={1}
          className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none"
          placeholder="답변 입력 후 Enter"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={loading}
          spellCheck={false}
          autoComplete="off"
        />
        <button
          className={`flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700
                      text-white font-semibold px-6 py-3 rounded-2xl shadow-lg transition
                      disabled:bg-blue-600 disabled:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed`}
          onClick={handleSend}
          disabled={loading || !input.trim()}
          aria-label="전송"
        >
          {loading ? "전송 중..." : "전송"}
        </button>
      </div>
    </main>
  );
}
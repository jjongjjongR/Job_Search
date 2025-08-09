// src/app/dataroom/new/page.tsx

"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import axios from "axios";

export default function UploadPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!session?.user?.name || !file) {
    console.error("이름 또는 파일이 없습니다.");
    return;
  }

  const formData = new FormData();
  formData.append("title", title);
  formData.append("uploader", session.user.name);
  formData.append("file", file);

  try {
    // 1. 파일 업로드
    const fileRes = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/files`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    const uploadedFile = fileRes.data;

    // 2. dataroom 등록 (id 연동)
    await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/dataroom`, {
      title: uploadedFile.title,
      description: uploadedFile.originalname, // 또는 적절한 설명
      uploader: uploadedFile.uploader,
    });

    router.push("/dataroom");
  } catch (err) {
    console.error("업로드 실패", err);
  }
};

  return (
    <main style={{ padding: "1rem", backgroundColor: "#f0f0f0", color: "#333" }}>
      <h1 style={{ color: "#001f3d" }}></h1>
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          maxWidth: "400px",
          margin: "0 auto",
          padding: "1rem",
          backgroundColor: "white",
          borderRadius: "8px",
          boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
        }}
      >
        <input
          type="text"
          placeholder="자료 제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          style={{
            padding: "0.8rem",
            fontSize: "1rem",
            borderRadius: "5px",
            border: "1px solid #ddd",
          }}
        />
        <input
          type="file"
          accept=".doc,.docx,.pdf,.ppt,.pptx,.hwp,.hwpx,.zip"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          required
          style={{
            padding: "0.8rem",
            fontSize: "1rem",
            borderRadius: "5px",
            border: "1px solid #ddd",
          }}
        />
        <button
          type="submit"
          style={{
            padding: "0.8rem",
            fontSize: "1rem",
            backgroundColor: "#001f3d",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            transition: "background-color 0.3s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#003366")}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#001f3d")}
        >
          업로드
        </button>
      </form>
    </main>
  );
}

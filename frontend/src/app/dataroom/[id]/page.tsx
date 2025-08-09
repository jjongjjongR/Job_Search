// src/app/dataroom/[id]/page.tsx

'use client';

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import axios from "axios";
import { isAdmin } from "@/lib/isAdmin";

export default function FileDetail() {
  const router = useRouter();
  const { data: session } = useSession();
  const params = useParams();
  const id = params?.id as string;

  const handleDelete = async () => {
    const confirmed = confirm('정말 삭제하시겠습니까?');
    if (!confirmed) return;

    try {
      // DELETE 요청 URL 서버 API에 맞게 정확히 맞추기 (예: /dataroom/{id})
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/dataroom/${id}`);

      alert('삭제가 완료되었습니다.');
      router.push('/dataroom');
    } catch (error: any) {
      console.error('삭제 중 오류:', error.response?.data ?? error.message ?? error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const getFile = async () => {
    const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/dataroom/${id}`);
    return res.data;
  };

  return (
    <main className="max-w-2xl mx-auto p-6 bg-white shadow-md rounded-lg">
      <FileContent getFile={getFile} onDelete={handleDelete} session={session} />
    </main>
  );
}

function FileContent({
  getFile,
  onDelete,
  session,
}: {
  getFile: () => Promise<any>;
  onDelete: () => void;
  session: any;
}) {
  const [file, setFile] = useState<any>(null);

  useEffect(() => {
    getFile()
      .then(setFile)
      .catch((err) => {
        console.error('파일 가져오기 실패:', err.response?.data ?? err.message ?? err);
        alert('자료를 불러오는 데 실패했습니다.');
      });
  }, []);
  

  if (!file) return <p>로딩 중...</p>;

  return (
    <>
      <h1 className="text-2xl font-bold mb-4">{file.title}</h1>
      <p className="text-gray-600 mb-4">업로더: {file.uploader}</p>

      <div className="flex space-x-4">
        <a
          href={`${process.env.NEXT_PUBLIC_API_URL}/files/${file.id}/download`}
          className="px-4 py-2 bg-[#0B1B3B] text-white rounded-lg shadow hover:bg-[#1E326B] transition"
        >
          다운로드
        </a>
        {isAdmin(session) && (
            <button
              onClick={onDelete}
              className="px-4 py-2 bg-[#0B1B3B] text-white rounded-lg shadow hover:bg-[#1E326B] transition"
            >
              자료 삭제
            </button>
        )}
      </div>
    </>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FeatureShell } from '@/components/feature-shell';
import { LoginRequiredCard } from '@/components/login-required-card';
import { apiRequest } from '@/lib/api';
import { getAccessToken, getStoredUser, type AuthUser } from '@/lib/auth';
import { isAdmin } from '@/lib/isAdmin';

type DataroomDetail = {
  id: number;
  title: string;
  description: string;
  uploader: string;
  fileId: number;
  file?: {
    id: number;
    createdAt: string;
    originalname: string;
  };
};

function getDownloadFilename(
  encodedFileName: string | null,
  contentDisposition: string | null,
  fallbackName: string,
) {
  if (encodedFileName) {
    try {
      return decodeURIComponent(encodedFileName);
    } catch {
      return fallbackName;
    }
  }

  if (!contentDisposition) {
    return fallbackName;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return fallbackName;
    }
  }

  const basicMatch = contentDisposition.match(/filename="([^"]+)"/i);
  return basicMatch?.[1] ?? fallbackName;
}

export default function DataroomDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [item, setItem] = useState<DataroomDetail | null>(null);
  const itemId = Number(params.id);

  useEffect(() => {
    const currentUser = getStoredUser();
    setUser(currentUser);

    const loadItem = async () => {
      const data = await apiRequest<DataroomDetail>(`/dataroom/${itemId}`);
      setItem(data);
    };

    if (currentUser && !Number.isNaN(itemId)) {
      void loadItem();
    }
  }, [itemId]);

  const handleDelete = async () => {
    if (!window.confirm('정말 삭제하시겠습니까?')) {
      return;
    }

    await apiRequest(`/dataroom/${itemId}`, { method: 'DELETE' });
    router.push('/dataroom');
  };

  const handleDownload = async () => {
    const token = getAccessToken();

    if (!token || !item) {
      return;
    }

    const fileId = item.file?.id ?? item.fileId;
    const fileName = item.file?.originalname ?? `${item.title}.file`;

    const response = await fetch(
      `${API_BASE_URL}/files/${fileId}/download`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const downloadName = getDownloadFilename(
      response.headers.get('X-File-Name'),
      response.headers.get('Content-Disposition'),
      fileName,
    );
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = downloadName;
    link.click();
    window.URL.revokeObjectURL(downloadUrl);
  };

  if (!item) {
    return (
      <FeatureShell
        eyebrow="Dataroom Detail"
        title="자료를 불러오는 중"
        description="잠시만 기다려 주세요."
      >
        {!user ? (
          <LoginRequiredCard
            title="자료 상세는 로그인 후 열람할 수 있습니다"
            description="파일 설명과 다운로드 링크는 회원 전용 콘텐츠입니다."
          />
        ) : (
          <div className="rounded-[28px] bg-white p-8">loading...</div>
        )}
      </FeatureShell>
    );
  }

  const canDelete = !!user && isAdmin(user);

  return (
    <FeatureShell
      eyebrow="Dataroom Detail"
      title={item.title}
      description="자료 설명과 다운로드 링크를 한 화면에서 확인할 수 있습니다."
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.75fr]">
        <div className="rounded-[28px] bg-white p-8 shadow-[0_18px_50px_rgba(16,36,61,0.07)]">
          <p className="text-sm text-[var(--text-muted)]">업로더: {item.uploader}</p>
          <p className="mt-6 whitespace-pre-wrap leading-7">{item.description}</p>
          {item.file?.createdAt ? (
            <p className="mt-4 text-sm text-[var(--text-muted)]">
              업로드일: {new Date(item.file.createdAt).toLocaleDateString()}
            </p>
          ) : null}
        </div>

        <div className="rounded-[28px] bg-[var(--card-strong)] p-7 text-white">
          <h2 className="text-xl font-bold">자료 작업</h2>
          <button
            onClick={() => void handleDownload()}
            className="mt-4 inline-block rounded-full bg-white px-4 py-2 font-semibold text-[var(--card-strong)]"
          >
            다운로드
          </button>
          {!isAdmin(user) ? (
            <p className="mt-4 text-sm leading-6 text-white/72">
              일반 회원은 자료 열람과 다운로드만 가능합니다.
            </p>
          ) : null}
          {canDelete ? (
            <button
              onClick={() => void handleDelete()}
              className="mt-4 block rounded-full border border-white/20 px-4 py-2 font-semibold"
            >
              자료 삭제
            </button>
          ) : null}
        </div>
      </div>
    </FeatureShell>
  );
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

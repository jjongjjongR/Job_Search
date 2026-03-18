'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FeatureShell } from '@/components/feature-shell';
import { ApiError, apiRequest } from '@/lib/api';
import { getAccessToken, getStoredUser, type AuthUser } from '@/lib/auth';
import { isAdmin } from '@/lib/isAdmin';

type UploadedFileResponse = {
  id: number;
  title: string;
  uploader: string;
  originalname: string;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

export default function UploadPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!user || !file) {
      setErrorMessage('로그인 후 파일을 선택해 주세요.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const accessToken = getAccessToken();

      if (!accessToken) {
        throw new Error('로그인 토큰이 없어 업로드를 진행할 수 없습니다.');
      }

      const formData = new FormData();
      formData.append('title', title);
      formData.append('file', file);

      const uploadResponse = await fetch(`${API_BASE_URL}/files`, {
        method: 'POST',
        body: formData,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!uploadResponse.ok) {
        if (uploadResponse.status === 401) {
          throw new ApiError('로그인이 만료되었거나 인증이 필요합니다.', 401);
        }

        throw new Error('파일 업로드에 실패했습니다.');
      }

      const uploadedFile =
        (await uploadResponse.json()) as UploadedFileResponse;

      await apiRequest('/dataroom', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description: description || uploadedFile.originalname,
          uploader: user.displayName,
          fileId: uploadedFile.id,
        }),
      });

      router.push('/dataroom');
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : '자료 업로드에 실패했습니다.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FeatureShell
      eyebrow="Dataroom Upload"
      title="자료 업로드"
      description="자료실 업로드는 MASTER 계정만 할 수 있습니다."
    >
      {user && isAdmin(user) ? (
        <form
          onSubmit={handleSubmit}
          className="rounded-[28px] bg-white p-8 shadow-[0_18px_50px_rgba(16,36,61,0.07)]"
        >
          <div className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">자료 제목</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--card-soft)] px-4 py-3"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">자료 설명</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="h-36 w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--card-soft)] px-4 py-3"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">파일 선택</span>
              <div className="rounded-[24px] border border-dashed border-[var(--border-soft)] bg-[var(--card-soft)] p-5">
                <input
                  id="dataroom-file"
                  type="file"
                  accept=".doc,.docx,.pdf,.ppt,.pptx,.hwp,.hwpx,.zip"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  className="hidden"
                />
                <label
                  htmlFor="dataroom-file"
                  className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[20px] bg-white px-4 py-8 text-center"
                >
                  <span className="text-sm font-semibold text-[var(--accent)]">
                    클릭해서 파일 선택
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    PDF, DOC, DOCX, PPT, PPTX, HWP, HWPX, ZIP
                  </span>
                </label>
                {file ? (
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold">{file.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="rounded-full border border-[var(--border-soft)] px-3 py-2 text-sm font-semibold"
                    >
                      선택 취소
                    </button>
                  </div>
                ) : null}
              </div>
            </label>
            {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-full bg-[var(--accent)] px-5 py-3 font-semibold text-white"
              >
                {isSubmitting ? '업로드 중...' : '자료 업로드'}
              </button>
            </div>
          </div>
        </form>
      ) : user ? (
        <div className="rounded-[28px] border border-[var(--border-soft)] bg-white p-8">
          <p className="font-semibold text-[var(--card-strong)]">
            자료 업로드는 MASTER 계정 전용 기능입니다.
          </p>
          <p className="mt-3 text-[var(--text-muted)]">
            현재 계정은 자료 열람과 다운로드만 사용할 수 있습니다.
          </p>
          <Link className="mt-4 inline-block font-semibold text-[var(--accent)]" href="/dataroom">
            자료실로 돌아가기
          </Link>
        </div>
      ) : (
        <div className="rounded-[28px] border border-[var(--border-soft)] bg-white p-8">
          <p className="text-[var(--text-muted)]">자료 업로드는 로그인 후 가능합니다.</p>
          <Link className="mt-4 inline-block font-semibold text-[var(--accent)]" href="/login">
            로그인하러 가기
          </Link>
        </div>
      )}
    </FeatureShell>
  );
}

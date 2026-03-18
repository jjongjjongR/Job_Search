'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FeatureShell } from '@/components/feature-shell';
import { LoginRequiredCard } from '@/components/login-required-card';
import { apiRequest } from '@/lib/api';
import { getStoredUser, type AuthUser } from '@/lib/auth';
import { isAdmin } from '@/lib/isAdmin';

type DataroomItem = {
  id: number;
  title: string;
  description: string;
  uploader: string;
  file?: {
    id: number;
    createdAt: string;
    originalname: string;
  };
};

export default function DataroomPage() {
  const router = useRouter();
  const [items, setItems] = useState<DataroomItem[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const currentUser = getStoredUser();
    setUser(currentUser);

    const loadItems = async () => {
      if (!currentUser) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await apiRequest<DataroomItem[]>('/dataroom');
        setItems(data);
      } finally {
        setIsLoading(false);
      }
    };

    void loadItems();
  }, []);

  return (
    <FeatureShell
      eyebrow="Dataroom"
      title="자료실"
      description="업로드된 파일 자료를 보고 바로 다운로드할 수 있습니다."
    >
      {!user ? (
        <LoginRequiredCard
          title="자료실은 로그인한 회원만 볼 수 있습니다"
          description="자료 목록, 설명, 다운로드 링크는 회원 전용입니다. 로그인 후 자료를 확인해 주세요."
        />
      ) : (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-[28px] bg-white p-6 shadow-[0_18px_50px_rgba(16,36,61,0.07)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">공유 자료 목록</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              회원은 자료를 열람하고 다운로드할 수 있고, MASTER 계정만 새 자료를 등록할 수 있습니다.
            </p>
          </div>
          {isAdmin(user) ? (
            <button
              onClick={() => router.push('/dataroom/new')}
              className="rounded-full bg-[var(--accent)] px-5 py-3 font-semibold text-white shadow-[0_12px_28px_rgba(30,111,217,0.28)]"
            >
              자료 업로드
            </button>
          ) : (
            <div className="rounded-full bg-[var(--card-soft)] px-5 py-3 text-sm font-semibold text-[var(--text-muted)]">
              일반 회원은 열람과 다운로드만 가능합니다
            </div>
          )}
        </div>

        <div className="grid gap-4">
          {isLoading ? <p>자료를 불러오는 중...</p> : null}
          {!isLoading && items.length === 0 ? (
            <div className="rounded-[28px] border border-[var(--border-soft)] bg-white p-8 text-[var(--text-muted)]">
              아직 자료가 없습니다.
            </div>
          ) : null}
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => router.push(`/dataroom/${item.id}`)}
              className="rounded-[28px] border border-[var(--border-soft)] bg-white p-6 text-left shadow-[0_16px_40px_rgba(16,36,61,0.05)] transition hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold">{item.title}</h3>
                  <p className="mt-2 text-sm text-[var(--text-muted)]">업로더: {item.uploader}</p>
                </div>
                <span className="rounded-full bg-[var(--card-soft)] px-3 py-2 text-xs font-semibold text-[var(--accent)]">
                  자료
                </span>
              </div>
              <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">{item.description}</p>
              {item.file?.createdAt ? (
                <p className="mt-3 text-xs text-[var(--text-muted)]">
                  업로드일: {new Date(item.file.createdAt).toLocaleDateString()}
                </p>
              ) : null}
            </button>
          ))}
        </div>
      </div>
      )}
    </FeatureShell>
  );
}

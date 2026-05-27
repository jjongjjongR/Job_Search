'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getStoredUser } from '@/lib/auth';

const links = [
  { href: '/', label: '홈' },
  { href: '/board', label: '게시판' },
  { href: '/dataroom', label: '자료실' },
  { href: '/ai_cover_letter', label: 'AI 자소서' },
  { href: '/ai_interview', label: 'AI 면접' },
];

export function SiteNavigation() {
  const [userLabel, setUserLabel] = useState('Guest');
  const pathname = usePathname();

  useEffect(() => {
    const syncUserLabel = () => {
      setUserLabel(getStoredUser() ? 'Logged In' : 'Guest');
    };

    syncUserLabel();
    window.addEventListener('storage', syncUserLabel);

    return () => window.removeEventListener('storage', syncUserLabel);
  }, []);

  // 2026-05-05 신규: AI 면접은 집중형 전용 화면으로 보여주기 위해 공통 네비게이션을 숨김
  if (pathname === '/ai_interview') {
    return null;
  }

  return (
    <nav className="mb-8 rounded-[28px] border border-[var(--border-soft)] bg-white/82 p-3 shadow-[0_12px_34px_rgba(16,36,61,0.05)] backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full border border-transparent px-4 py-2 text-sm font-semibold text-[var(--text-muted)] transition hover:border-[var(--border-soft)] hover:bg-[var(--card-soft)] hover:text-[var(--accent)]"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="rounded-full bg-[var(--card-soft)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
          {userLabel}
        </div>
      </div>
    </nav>
  );
}

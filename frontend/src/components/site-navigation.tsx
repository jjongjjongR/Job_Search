'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getStoredUser } from '@/lib/auth';

const links = [
  { href: '/', label: '홈' },
  { href: '/board', label: '게시판' },
  { href: '/dataroom', label: '자료실' },
  { href: '/mypage', label: '내 계정' },
  { href: '/me', label: '내 정보' },
  { href: '/ai_cover_letter', label: 'AI 자소서' },
  { href: '/ai_interview', label: 'AI 면접' },
];

export function SiteNavigation() {
  const [userLabel, setUserLabel] = useState('Guest');

  useEffect(() => {
    const syncUserLabel = () => {
      setUserLabel(getStoredUser() ? 'Logged In' : 'Guest');
    };

    syncUserLabel();
    window.addEventListener('storage', syncUserLabel);

    return () => window.removeEventListener('storage', syncUserLabel);
  }, []);

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

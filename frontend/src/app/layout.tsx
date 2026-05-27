import type { Metadata } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/site-header';
import { SiteNavigation } from '@/components/site-navigation';

export const metadata: Metadata = {
  title: '온세상이취업 | World Job Search',
  description: '취업 준비를 한 곳에서 이어가는 World Job Search 서비스',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-[var(--page-bg)] text-[var(--text-main)]">
        <div className="mx-auto min-h-screen max-w-6xl px-4 py-6 sm:px-6">
          <SiteHeader />
          <SiteNavigation />
          <main className="pb-10">{children}</main>
        </div>
      </body>
    </html>
  );
}

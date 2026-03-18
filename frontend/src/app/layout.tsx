import type { Metadata } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/site-header';
import { SiteNavigation } from '@/components/site-navigation';

export const metadata: Metadata = {
  title: 'World Job Search',
  description: 'JWT 인증 뼈대가 적용된 취업 준비 서비스',
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

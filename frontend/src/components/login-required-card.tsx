import Link from 'next/link';

export function LoginRequiredCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[32px] border border-[var(--border-soft)] bg-white p-8 shadow-[0_18px_50px_rgba(16,36,61,0.07)]">
      <div className="inline-flex rounded-full bg-[var(--card-soft)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
        Members Only
      </div>
      <h2 className="mt-4 text-2xl font-bold">{title}</h2>
      <p className="mt-3 max-w-2xl leading-7 text-[var(--text-muted)]">{description}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/login"
          className="rounded-full bg-[var(--accent)] px-5 py-3 font-semibold text-white shadow-[0_12px_28px_rgba(30,111,217,0.24)]"
        >
          로그인
        </Link>
        <Link
          href="/signup"
          className="rounded-full border border-[var(--border-soft)] px-5 py-3 font-semibold"
        >
          회원가입
        </Link>
      </div>
    </div>
  );
}

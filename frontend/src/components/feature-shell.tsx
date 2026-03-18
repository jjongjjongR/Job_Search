import type { ReactNode } from 'react';

export function FeatureShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="mx-auto max-w-5xl">
      <div className="rounded-[36px] border border-[var(--border-soft)] bg-[var(--page-panel)] p-8 shadow-[0_24px_80px_rgba(16,36,61,0.08)] backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{title}</h1>
        <p className="mt-4 max-w-3xl leading-7 text-[var(--text-muted)]">
          {description}
        </p>
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

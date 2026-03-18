'use client';

import Link from 'next/link';
import { FeatureShell } from '@/components/feature-shell';

const envItems = [
  'LLM_PROVIDER, OPENAI_API_KEY',
  'STT_PROVIDER, TTS_PROVIDER, VISION_PROVIDER',
  'REDIS_HOST, REDIS_PORT, REDIS_TTL_SECONDS',
  'STORAGE_PROVIDER, S3_BUCKET 또는 LOCAL_STORAGE_ROOT',
  'INTERNAL_API_SHARED_SECRET',
];

export default function AICoverLetterPage() {
  return (
    <FeatureShell
      eyebrow="AI Cover Letter"
      title="자소서 AI 분석 영역은 다음 단계용으로 준비되어 있습니다"
      description="이번 단계에서는 인증 경계를 먼저 완성했고, AI 서버는 외부 공개 없이 내부 전용으로 붙일 수 있도록 환경변수와 화면 뼈대만 정리했습니다."
    >
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[28px] bg-white p-8 shadow-[0_18px_50px_rgba(16,36,61,0.07)]">
          <h2 className="text-2xl font-bold">예정된 처리 흐름</h2>
          <div className="mt-5 grid gap-3">
            {[
              '프론트엔드는 NestJS 공개 API에만 요청합니다.',
              'NestJS는 JWT 인증 후 내부 FastAPI로 자소서 분석을 전달합니다.',
              'FastAPI는 LLM 도구를 사용해 분석 결과를 만들고, 사용자에게는 정리된 결과만 반환합니다.',
              '중간 추론 데이터는 최소화하고 장기 저장은 피하는 방향을 유지합니다.',
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-[var(--border-soft)] bg-[var(--card-soft)] px-4 py-4 text-sm leading-6 text-[var(--text-muted)]"
              >
                {item}
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-full bg-[var(--accent)] px-4 py-3 font-semibold text-white shadow-[0_12px_28px_rgba(30,111,217,0.28)]"
            >
              로그인하러 가기
            </Link>
            <Link
              href="/"
              className="rounded-full border border-[var(--border-soft)] bg-white px-4 py-3 font-semibold"
            >
              홈으로 이동
            </Link>
          </div>
        </div>

        <div className="rounded-[28px] bg-[var(--card-strong)] p-7 text-white">
          <h2 className="text-xl font-bold">AI 서버 준비 상태</h2>
          <p className="mt-3 text-sm leading-6 text-white/78">
            아래 값들은 [ai/.env.example](/Users/jjongm3pro/Desktop/project/World_Job_Search/ai/.env.example)에 미리 정리해 두었습니다.
          </p>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-white/78">
            {envItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </FeatureShell>
  );
}

'use client';

import { FeatureShell } from '@/components/feature-shell';

const interviewSteps = [
  '첫 질문은 고정 자기소개로 시작',
  'NestJS 인증 후 내부 FastAPI로 세션 시작 요청',
  'LangGraph가 topic queue와 follow-up 제한 관리',
  'STT / Vision / TTS는 도구로만 사용',
  '최종 결과만 사용자에게 반환',
];

export default function InterviewPage() {
  return (
    <FeatureShell
      eyebrow="AI Interview"
      title="면접 멀티 에이전트 영역은 내부 전용 아키텍처 기준으로 준비 중입니다"
      description="사용자는 Next.js와 NestJS만 보게 하고, FastAPI와 LangGraph는 내부 오케스트레이션 서버로 동작시키는 방향을 유지합니다."
    >
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[28px] bg-white p-8 shadow-[0_18px_50px_rgba(16,36,61,0.07)]">
          <h2 className="text-2xl font-bold">면접 세션 설계 요약</h2>
          <div className="mt-5 grid gap-3">
            {interviewSteps.map((step, index) => (
              <div
                key={step}
                className="grid grid-cols-[44px_1fr] items-start gap-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--card-soft)] px-4 py-4"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent)] font-bold text-white">
                  {index + 1}
                </div>
                <p className="pt-2 text-sm leading-6 text-[var(--text-muted)]">{step}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[28px] bg-[var(--card-strong)] p-7 text-white">
            <h2 className="text-xl font-bold">내부 보호 원칙</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-white/78">
              <li>FastAPI는 외부 공개 API가 아닙니다.</li>
              <li>JWT 검증은 NestJS에서만 처리합니다.</li>
              <li>Vision은 감정 분석이 아니라 관찰 가능한 신호만 사용합니다.</li>
              <li>세션 종료 후 임시 데이터는 TTL 정책으로 정리합니다.</li>
            </ul>
          </div>

          <div className="rounded-[28px] border border-[var(--border-soft)] bg-white p-7">
            <h2 className="text-xl font-bold">준비된 환경변수 묶음</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
              Redis, storage, internal shared secret, tool provider, 파일 제한 정책까지 AI 서버용 예시 값을 미리 준비했습니다.
            </p>
          </div>
        </div>
      </div>
    </FeatureShell>
  );
}

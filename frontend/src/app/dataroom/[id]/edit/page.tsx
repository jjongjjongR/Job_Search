'use client';

import { FeatureShell } from '@/components/feature-shell';

export default function DataroomEditPlaceholderPage() {
  return (
    <FeatureShell
      eyebrow="Dataroom Edit"
      title="자료실 수정 기능은 아직 정리 중입니다"
      description="기존 라우트 호환성은 유지하되, 현재 동작 범위에서는 자료 조회, 업로드, 다운로드, 삭제까지 우선 연결했습니다."
    >
      <div className="rounded-[28px] bg-white p-8 text-[var(--text-muted)]">
        필요하면 다음 단계에서 자료 메타데이터 수정 기능도 이어서 붙일 수 있습니다.
      </div>
    </FeatureShell>
  );
}

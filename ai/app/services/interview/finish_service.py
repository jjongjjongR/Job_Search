# ai/app/services/interview/finish_service.py
# 면접 세션 종료 더미 응답을 반환하는 서비스 파일

from datetime import datetime, timezone

from app.adapters.redis_state_store import redis_interview_state_store
from app.schemas.common import InterviewSessionStatus
from app.schemas.interview import (
    FinalReport,
    InterviewFinishRequest,
    InterviewFinishResponse,
)

# 2026.04.01 이종헌 신규
async def interview_finish_service(
    payload: InterviewFinishRequest,
) -> InterviewFinishResponse:
    finished_at = datetime.now(timezone.utc).isoformat()
    response = InterviewFinishResponse(
        status=InterviewSessionStatus.FINISHED,
        finishedAt=finished_at,
        finalReport=FinalReport(
            totalScore=81,
            grade="우수",
            summary="전반적으로 논리 구조는 좋지만 근거 설명은 더 필요합니다.",
            strengths=[
                "직무 연결이 잘 되었습니다.",
                "답변 흐름이 안정적입니다.",
                "협업 경험이 드러났습니다.",
            ],
            weaknesses=[
                "성과 근거가 약합니다.",
                "역할 설명이 다소 추상적입니다.",
                "답변 길이 편차가 있습니다.",
            ],
            practiceDirections=[
                "성과를 숫자로 정리하세요.",
                "역할을 한 문장으로 먼저 말하세요.",
                "마지막을 직무 연결로 닫으세요.",
            ],
        ),
    )

    # 2026.04.10 신규: 세션 종료 시 cleanup deadline key를 기록
    await redis_interview_state_store.schedule_cleanup(
        session_id=payload.sessionId,
        ttl_seconds=600,
    )
    await redis_interview_state_store.save_session_state(
        session_id=payload.sessionId,
        payload={
            "status": response.status,
            "finishedAt": response.finishedAt,
            "cleanupScheduled": True,
        },
    )

    return response

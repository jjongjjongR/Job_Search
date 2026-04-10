# ai/app/services/interview/start_service.py
# 면접 세션 시작 더미 응답을 반환하는 서비스 파일

from app.adapters.redis_state_store import redis_interview_state_store
from app.schemas.common import (
    DocumentSufficiency,
    InterviewQuestionType,
    InterviewSessionStatus,
    QuestionItem,
)
from app.schemas.interview import (
    InterviewSessionState,
    InterviewStartRequest,
    InterviewStartResponse,
)

# 2026.04.01 이종헌 신규
async def interview_start_service(
    payload: InterviewStartRequest,
) -> InterviewStartResponse:
    response = InterviewStartResponse(
        documentSufficiency=DocumentSufficiency.SUFFICIENT,
        question=QuestionItem(
            turnNumber=1,
            questionType=InterviewQuestionType.SELF_INTRO,
            questionText="1분 자기소개 부탁드립니다.",
        ),
        sessionState=InterviewSessionState(
            status=InterviewSessionStatus.IN_PROGRESS,
            currentQuestionNumber=1,
            followUpCountForCurrentQuestion=0,
        ),
    )

    # 2026.04.10 신규: 세션 시작 시 Redis에 현재 인터뷰 상태를 저장
    await redis_interview_state_store.save_session_state(
        session_id=payload.sessionId,
        payload={
            "status": response.sessionState.status,
            "documentSufficiency": response.documentSufficiency,
            "currentQuestionNumber": response.sessionState.currentQuestionNumber,
            "followUpCountForCurrentQuestion": response.sessionState.followUpCountForCurrentQuestion,
            "currentQuestionType": response.question.questionType,
            "currentQuestionText": response.question.questionText,
        },
    )

    return response

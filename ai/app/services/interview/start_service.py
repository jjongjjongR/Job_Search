# ai/app/services/interview/start_service.py
# 면접 세션 시작 더미 응답을 반환하는 서비스 파일

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
def interview_start_service(
    payload: InterviewStartRequest,
) -> InterviewStartResponse:
    return InterviewStartResponse(
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
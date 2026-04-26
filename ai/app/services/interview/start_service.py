# ai/app/services/interview/start_service.py
# 면접 세션 시작 더미 응답을 반환하는 서비스 파일

from fastapi import HTTPException

from app.adapters.redis_state_store import redis_interview_state_store
from app.schemas.common import (
    DocumentSufficiency,
    ErrorCode,
    InterviewQuestionType,
    InterviewSessionStatus,
    QuestionItem,
)
from app.schemas.interview import (
    InterviewSessionState,
    InterviewStartRequest,
    InterviewStartResponse,
)
from app.services.interview.question_planner import (
    build_question_plan,
    normalize_interview_documents,
)


# 2026-04-15 신규: 문서 충분도 규칙을 고정값으로 계산
def _determine_document_sufficiency(payload: InterviewStartRequest) -> DocumentSufficiency:
    normalized_documents = normalize_interview_documents(payload.documents)
    has_jd = bool(payload.jdText.strip())
    has_user_document = any(bool(text.strip()) for text in normalized_documents.values())

    if has_jd and has_user_document:
        return DocumentSufficiency.SUFFICIENT
    if has_jd:
        return DocumentSufficiency.JD_ONLY
    return DocumentSufficiency.INSUFFICIENT

# 2026.04.01 이종헌 신규
async def interview_start_service(
    payload: InterviewStartRequest,
) -> InterviewStartResponse:
    document_sufficiency = _determine_document_sufficiency(payload)
    # 2026-04-25 수정: 자료 기준에 맞춰 문서 부족 상태에서는 면접 세션 시작 자체를 막음
    if document_sufficiency == DocumentSufficiency.INSUFFICIENT:
        raise HTTPException(
            status_code=400,
            detail={
                "errorCode": ErrorCode.DOCUMENT_INSUFFICIENT,
                "message": "JD 또는 사용자 문서가 부족해 면접 세션을 시작할 수 없습니다.",
                "retryable": False,
            },
        )
    question_plan = build_question_plan(
        company_name=payload.companyName,
        position_name=payload.positionName,
        jd_text=payload.jdText,
        documents=payload.documents,
        document_sufficiency=document_sufficiency,
    )
    first_question = question_plan[0]

    response = InterviewStartResponse(
        documentSufficiency=document_sufficiency,
        question=QuestionItem(
            turnNumber=int(first_question["turnNumber"]),
            questionType=InterviewQuestionType(first_question["questionType"]),
            questionText=str(first_question["questionText"]),
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
            "currentPlanIndex": 0,
            "totalQuestionCount": len(question_plan),
            "currentQuestionType": response.question.questionType,
            "currentQuestionText": response.question.questionText,
            "plannedQuestions": question_plan,
            "companyName": payload.companyName,
            "positionName": payload.positionName,
            "jdText": payload.jdText,
            "documents": normalize_interview_documents(payload.documents),
        },
    )

    return response

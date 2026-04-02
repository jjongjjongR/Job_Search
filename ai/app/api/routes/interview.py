# ai/app/api/routes/interview.py
# 면접 시작, 답변 처리, 종료 관련 내부 API를 두는 라우트 파일

from fastapi import APIRouter, Depends

from app.api.deps import verify_internal_shared_secret
from app.schemas.interview import (
    InterviewAnswerRequest,
    InterviewAnswerResponse,
    InterviewFinishRequest,
    InterviewFinishResponse,
    InterviewStartRequest,
    InterviewStartResponse,
)
from app.services.interview.answer_service import interview_answer_service
from app.services.interview.finish_service import interview_finish_service
from app.services.interview.start_service import interview_start_service


# 2026.04.01 이종헌: 수정(secret 적용)
router = APIRouter(
    prefix="/internal/interview",
    tags=["interview"],
    dependencies=[Depends(verify_internal_shared_secret)],
)


# 2026.04.01 이종헌: 수정(서비스 분리)
@router.post("/start", response_model=InterviewStartResponse)
def interview_start(payload: InterviewStartRequest) -> InterviewStartResponse:
    return interview_start_service(payload)


# 2026.04.01 이종헌: 수정(서비스 분리)
@router.post("/answer", response_model=InterviewAnswerResponse)
def interview_answer(payload: InterviewAnswerRequest) -> InterviewAnswerResponse:
    return interview_answer_service(payload)


# 2026.04.01 이종헌: 수정(서비스 분리)
@router.post("/finish", response_model=InterviewFinishResponse)
def interview_finish(payload: InterviewFinishRequest) -> InterviewFinishResponse:
    return interview_finish_service(payload)
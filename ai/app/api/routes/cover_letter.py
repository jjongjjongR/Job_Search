# ai/app/api/routes/cover_letter.py
# 자소서 피드백 관련 내부 API를 두는 라우트 파일

from fastapi import APIRouter, Depends

from app.api.deps import verify_internal_shared_secret
from app.schemas.cover_letter import (
    CoverLetterFeedbackRequest,
    CoverLetterFeedbackResponse,
)
from app.services.cover_letter.feedback_service import cover_letter_feedback_service


# 2026.04.01 이종헌: 수정(secret 적용)
router = APIRouter(
    prefix="/internal/cover-letter",
    tags=["cover_letter"],
    dependencies=[Depends(verify_internal_shared_secret)],
)


# 2026.04.01 이종헌: 수정(서비스 분리)
@router.post("/feedback", response_model=CoverLetterFeedbackResponse)
def cover_letter_feedback(
    payload: CoverLetterFeedbackRequest,
) -> CoverLetterFeedbackResponse:
    return cover_letter_feedback_service(payload)
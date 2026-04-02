# ai/app/services/cover_letter/feedback_service.py
# 자소서 피드백 더미 응답을 반환하는 서비스 파일

from app.schemas.cover_letter import (
    CoverLetterFeedbackRequest,
    CoverLetterFeedbackResponse,
)

# 2026.04.01 이종헌: 신규
def cover_letter_feedback_service(
    payload: CoverLetterFeedbackRequest,
) -> CoverLetterFeedbackResponse:
    return CoverLetterFeedbackResponse(
        totalScore=84,
        summary="더미 자소서 피드백 요약입니다.",
        strengths=[
            "직무 키워드 반영이 좋습니다.",
            "문장 흐름이 안정적입니다.",
            "지원 동기가 비교적 명확합니다.",
        ],
        weaknesses=[
            "성과 근거가 부족합니다.",
            "역할 설명이 약합니다.",
            "프로젝트 연결이 추상적입니다.",
        ],
        revisionDirections=[
            "성과를 숫자로 적어보세요.",
            "본인 역할을 더 구체적으로 쓰세요.",
            "직무 연결 문장을 보강하세요.",
        ],
    )
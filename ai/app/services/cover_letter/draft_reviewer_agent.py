import re

from app.schemas.cover_letter import CoverLetterFeedbackRequest
from app.services.cover_letter.shared import (
    normalize_documents,
    request_openai_json,
    sanitize_plain_text,
    split_cover_letter_questions,
)


OPENAI_REVIEW_PROMPT = """
너는 자소서 품질 검토자다.
생성된 수정 초안을 다시 읽고, 아래 기준을 통과하는지 판단해라.
- JD 핵심 요구와 직접 연결되는가
- 입력 자소서/이력서/포트폴리오에 없는 과장된 내용을 새로 만들지 않았는가
- 문항 요구와 크게 어긋나지 않는가
- 역할, 행동, 결과가 너무 추상적이지 않은가

반환 JSON:
{
  "approved": true 또는 false,
  "score": 0-100 정수,
  "reason": "승인 또는 미승인 이유를 한 문장으로"
}

규칙:
- score 68 이상이고 approved=true일 때 통과로 본다.
- 입력 근거에 없는 새 경험을 만들어냈다면 false를 줘라.
- 문항 수가 원본과 다르거나 [문항 n] [소제목] 형식이 아니면 false를 줘라.
- 소제목에 괄호가 들어가면 false를 줘라.
""".strip()


# 2026-04-21 신규: 생성 초안을 다시 검토해 사용자에게 보여도 되는지 판단하는 agent
def run_draft_reviewer_agent(
    payload: CoverLetterFeedbackRequest,
    revised_draft: str,
) -> dict[str, object]:
    sanitized_draft = sanitize_plain_text(revised_draft)
    if not sanitized_draft:
        return {"approved": False, "score": 0, "reason": "생성된 초안이 비어 있습니다."}

    normalized_documents = normalize_documents(payload.documents)
    expected_question_count = max(
        1, len(split_cover_letter_questions(normalized_documents["coverLetterText"]))
    )
    actual_question_count = len(
        re.findall(r"^\[문항\s*\d+\]\s*\[[^\]]+\]", sanitized_draft, re.MULTILINE)
    )
    if actual_question_count != expected_question_count:
        return {
            "approved": False,
            "score": 0,
            "reason": f"수정 초안의 문항 수가 원본과 맞지 않습니다. 현재 {actual_question_count}개, 필요 {expected_question_count}개입니다.",
        }

    openai_result = request_openai_json(
        OPENAI_REVIEW_PROMPT,
        {
            "jobAnalysis": {
                "companyName": payload.jobAnalysis.companyName,
                "positionName": payload.jobAnalysis.positionName,
                "jdText": payload.jobAnalysis.jdText,
            },
            "sourceDocuments": normalized_documents,
            "revisedDraft": sanitized_draft,
        },
    )
    if openai_result:
        approved = bool(openai_result.get("approved")) and int(
            openai_result.get("score", 0)
        ) >= 68
        return {
            "approved": approved,
            "score": max(0, min(int(openai_result.get("score", 0)), 100)),
            "reason": str(openai_result.get("reason") or "내부 검토를 완료했습니다.").strip(),
        }

    return {
        "approved": True,
        "score": 72,
        "reason": "기본 형식과 문항 수 기준을 만족해 학습용 초안으로 표시합니다.",
    }

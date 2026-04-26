import re

from app.schemas.cover_letter import CoverLetterFeedbackRequest
from app.services.cover_letter.shared import (
    fill_to_three,
    normalize_documents,
    request_openai_json,
    sanitize_plain_text,
    split_cover_letter_questions,
)


OPENAI_DRAFT_PROMPT = """
너는 자소서 수정 초안 작성 전문가다.
평가 결과를 바탕으로 자소서를 다시 쓰되, 입력 근거에 없는 새 경험을 만들지 마라.

반드시 지켜라:
- 마크다운 문법(#, *, **, -, 백틱)을 쓰지 마라.
- 괄호를 쓰지 마라.
- 원본 자소서 문항 수를 반드시 유지해라.
- 각 문항은 반드시 아래 형식으로 작성해라.
[문항 1] [소제목]
본문...
- 소제목은 반드시 생성해야 하며, 짧고 내용과 어울려야 한다.
- 각 문항 본문은 질문에 맞는 경험만 쓰고, 역할/행동/결과/직무 연결이 드러나야 한다.
- retrievedEvidence에 없는 새 경험은 만들지 마라.

반환 JSON:
{
  "revisedDraft": "평문 초안 전체"
}
""".strip()


# 2026-04-21 신규: 평가 결과를 바탕으로 사용자에게 보여줄 수정 초안을 생성하는 agent
def run_draft_generator_agent(
    payload: CoverLetterFeedbackRequest,
    evaluation_context: dict[str, object],
) -> dict[str, object]:
    normalized_documents = normalize_documents(payload.documents)
    question_blocks = split_cover_letter_questions(normalized_documents["coverLetterText"])

    openai_result = request_openai_json(
        OPENAI_DRAFT_PROMPT,
        {
            "jobAnalysis": {
                "companyName": payload.jobAnalysis.companyName,
                "positionName": payload.jobAnalysis.positionName,
                "jdText": payload.jobAnalysis.jdText,
            },
            "documents": normalized_documents,
            "evaluation": {
                "summary": evaluation_context["summary"],
                "strengths": evaluation_context["strengths"],
                "weaknesses": evaluation_context["weaknesses"],
                "revisionDirections": evaluation_context["revisionDirections"],
                "nextActions": evaluation_context["nextActions"],
                "retrievedEvidence": evaluation_context.get("retrievedEvidence", []),
            },
        },
    )
    openai_draft = sanitize_plain_text(str((openai_result or {}).get("revisedDraft") or ""))
    if openai_draft:
        return {"revisedDraft": openai_draft, "source": "OPENAI"}

    rewritten_sections: list[str] = []
    fallback_titles = fill_to_three(
        [],
        [
            "직무 연결 경험",
            "문제 해결 경험",
            "성과 중심 성장 경험",
        ],
    )

    for index, (question_number, _, body) in enumerate(question_blocks):
        compact_body = re.sub(r"\s+", " ", body).strip()
        title = fallback_titles[min(index, len(fallback_titles) - 1)]
        if not compact_body:
            compact_body = "직무와 연결되는 핵심 경험을 역할, 행동, 결과 순서로 다시 정리하겠습니다."
        rewritten_sections.append(
            "\n".join(
                [
                    f"[문항 {question_number}] [{title}]",
                    compact_body,
                    "이 경험을 바탕으로 지원 직무에서 빠르게 기여할 수 있다고 생각합니다.",
                ]
            ).strip()
        )

    return {
        "revisedDraft": "\n\n".join(rewritten_sections).strip(),
        "source": "HEURISTIC",
    }

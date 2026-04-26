from app.schemas.cover_letter import CoverLetterFeedbackRequest
from app.services.cover_letter.shared import (
    build_question_inputs,
    count_keyword_hits,
    normalize_documents,
)


# 2026-04-21 신규: 지원자 문서에서 평가 근거와 문항 단위 입력을 정리하는 agent
def run_evidence_extractor_agent(
    payload: CoverLetterFeedbackRequest,
    jd_keywords: list[str],
    rag_context: dict[str, object] | None = None,
) -> dict[str, object]:
    normalized_documents = normalize_documents(payload.documents)
    cover_letter_text = normalized_documents["coverLetterText"]
    resume_text = normalized_documents["resumeText"]
    portfolio_text = normalized_documents["portfolioText"]
    combined_text = " ".join(
        text for text in [cover_letter_text, resume_text, portfolio_text] if text
    )

    return {
        "documents": normalized_documents,
        "combinedText": combined_text,
        "questionInputs": build_question_inputs(payload),
        "keywordHits": count_keyword_hits(jd_keywords, combined_text),
        "hasResume": bool(resume_text.strip()),
        "hasPortfolio": bool(portfolio_text.strip()),
        "rag": rag_context or {
            "collectionId": None,
            "chunkCount": 0,
            "retrievedEvidence": [],
        },
    }

from __future__ import annotations

from app.schemas.common import EvaluationValidationResult
from app.services.cover_letter.shared import request_openai_json


OPENAI_VALIDATOR_PROMPT = """
너는 자소서 평가 결과를 검증하는 evaluation_validator agent다.
평가를 새로 작성하지 말고, evaluator가 만든 결과가 입력 근거와 일관적인지만 검사한다.
반드시 JSON만 반환한다.

검증 기준:
1. evidenceText가 입력 문서 또는 RAG 근거와 연결되는가.
2. verified=false 항목이 많은데 totalScore가 과하게 높지 않은가.
3. rubricScores 합계와 totalScore가 일관적인가.
4. 강점, 약점, 수정 방향이 서로 모순되지 않는가.
5. JD에 없는 역량이나 입력 문서에 없는 경험을 근거처럼 쓰지 않았는가.

반환 JSON:
{
  "valid": true,
  "confidence": 0.0-1.0,
  "reasons": ["문자열"],
  "retryInstruction": "재평가가 필요할 때 evaluator에게 줄 지시문"
}
""".strip()


def run_cover_letter_evaluation_validator_agent(
    evaluation_context: dict[str, object],
    jd_context: dict[str, object],
    evidence_context: dict[str, object],
    retry_count: int = 0,
) -> EvaluationValidationResult:
    consistency_reasons = _score_consistency_reasons(evaluation_context)
    openai_result = request_openai_json(
        OPENAI_VALIDATOR_PROMPT,
        {
            "jobAnalysis": {
                "companyName": jd_context["companyName"],
                "positionName": jd_context["positionName"],
                "jdText": jd_context["jdText"],
                "jdKeywords": jd_context["jdKeywords"],
                "jobFocusKeywords": jd_context["jobFocusKeywords"],
            },
            "evaluation": _serialize_evaluation(evaluation_context),
            "documents": evidence_context["documents"],
            "retrievedEvidence": evidence_context["rag"]["retrievedEvidence"],
        },
    )
    if openai_result:
        return _normalize_validation_result(
            openai_result,
            retry_count,
            consistency_reasons,
        )

    return _heuristic_validation(evaluation_context, retry_count, consistency_reasons)


def _serialize_evaluation(evaluation_context: dict[str, object]) -> dict[str, object]:
    return {
        "source": evaluation_context.get("source"),
        "totalScore": evaluation_context.get("totalScore"),
        "jdAlignmentScore": evaluation_context.get("jdAlignmentScore"),
        "jobFitScore": evaluation_context.get("jobFitScore"),
        "confidence": evaluation_context.get("confidence"),
        "summary": evaluation_context.get("summary"),
        "strengths": evaluation_context.get("strengths", []),
        "weaknesses": evaluation_context.get("weaknesses", []),
        "revisionDirections": evaluation_context.get("revisionDirections", []),
        "nextActions": evaluation_context.get("nextActions", []),
        "rubricScores": [
            item.model_dump() if hasattr(item, "model_dump") else item
            for item in evaluation_context.get("rubricScores", [])
        ],
        "questionScores": [
            item.model_dump() if hasattr(item, "model_dump") else item
            for item in evaluation_context.get("questionScores", [])
        ],
    }


def _normalize_validation_result(
    raw_result: dict[str, object],
    retry_count: int,
    consistency_reasons: list[str] | None = None,
) -> EvaluationValidationResult:
    reasons = [
        str(item).strip()
        for item in raw_result.get("reasons", [])
        if str(item).strip()
    ][:5]
    reasons = [*reasons, *(consistency_reasons or [])][:5]
    confidence = max(0.0, min(float(raw_result.get("confidence", 0.0)), 1.0))
    valid = bool(raw_result.get("valid")) and confidence >= 0.55 and not consistency_reasons
    retry_instruction = str(raw_result.get("retryInstruction") or "").strip()
    if not retry_instruction and reasons:
        retry_instruction = "검증 실패 이유를 반영해 근거가 확인되는 항목만 보수적으로 다시 평가하세요."

    return EvaluationValidationResult(
        valid=valid,
        confidence=confidence,
        reasons=[] if valid else reasons,
        retryInstruction="" if valid else retry_instruction,
        retryCount=retry_count,
    )


def _heuristic_validation(
    evaluation_context: dict[str, object],
    retry_count: int,
    consistency_reasons: list[str] | None = None,
) -> EvaluationValidationResult:
    rubric_scores = list(evaluation_context.get("rubricScores", []))
    total_score = int(evaluation_context.get("totalScore", 0))
    rubric_total = sum(int(getattr(item, "score", 0)) for item in rubric_scores)
    verified_count = sum(1 for item in rubric_scores if bool(getattr(item, "verified", False)))
    total_count = max(1, len(rubric_scores))
    verified_ratio = verified_count / total_count

    reasons: list[str] = []
    if abs(total_score - rubric_total) > 5:
        reasons.append("rubricScores 합계와 totalScore 차이가 큽니다.")
    if verified_ratio < 0.35:
        reasons.append("검증된 근거 항목 비율이 낮습니다.")
    if verified_ratio < 0.5 and total_score >= 80:
        reasons.append("근거 검증 비율에 비해 종합 점수가 높습니다.")
    reasons.extend(consistency_reasons or [])

    valid = not reasons
    confidence = min(0.95, 0.45 + verified_ratio * 0.45)
    return EvaluationValidationResult(
        valid=valid,
        confidence=round(confidence, 2),
        reasons=reasons,
        retryInstruction=(
            "" if valid else "검증되지 않은 근거 항목 점수를 낮추고 확인 가능한 근거만 사용해 다시 평가하세요."
        ),
        retryCount=retry_count,
    )


def _score_consistency_reasons(evaluation_context: dict[str, object]) -> list[str]:
    rubric_scores = list(evaluation_context.get("rubricScores", []))

    def rubric_percent(category: str) -> int | None:
        for item in rubric_scores:
            item_category = str(getattr(item, "category", "")).strip()
            max_score = int(getattr(item, "maxScore", 0))
            if item_category == category and max_score > 0:
                return round(int(getattr(item, "score", 0)) / max_score * 100)
        return None

    reasons: list[str] = []
    jd_rubric_score = rubric_percent("JD 반영도")
    if jd_rubric_score is not None:
        jd_alignment_score = int(evaluation_context.get("jdAlignmentScore", 0))
        if abs(jd_alignment_score - jd_rubric_score) > 15:
            reasons.append("JD 반영도 상단 점수와 항목별 점수가 일관되지 않습니다.")

    job_fit_rubric_score = rubric_percent("직무 적합도")
    if job_fit_rubric_score is not None:
        job_fit_score = int(evaluation_context.get("jobFitScore", 0))
        if abs(job_fit_score - job_fit_rubric_score) > 15:
            reasons.append("직무 적합도 상단 점수와 항목별 점수가 일관되지 않습니다.")

    return reasons

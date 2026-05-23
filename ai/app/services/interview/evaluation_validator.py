from __future__ import annotations

import json
import re

import httpx

from app.core.config import settings
from app.schemas.common import EvaluationValidationResult


OPENAI_TIMEOUT_SECONDS = 15.0


def validate_interview_evaluation(
    evaluation: dict[str, object],
    question_text: str,
    answer_text: str,
    jd_text: str,
    retrieved_evidence: list[dict[str, object]] | None = None,
    retry_count: int = 0,
) -> EvaluationValidationResult:
    openai_result = _request_openai_validation(
        evaluation=evaluation,
        question_text=question_text,
        answer_text=answer_text,
        jd_text=jd_text,
        retrieved_evidence=retrieved_evidence or [],
    )
    if openai_result:
        return _normalize_validation(openai_result, retry_count)

    return _heuristic_validation(evaluation, answer_text, retry_count)


def _request_openai_validation(
    evaluation: dict[str, object],
    question_text: str,
    answer_text: str,
    jd_text: str,
    retrieved_evidence: list[dict[str, object]],
) -> dict[str, object] | None:
    if not settings.OPENAI_API_KEY:
        return None

    system_prompt = """
너는 면접 답변 평가 결과를 검증하는 answer_evaluation_validator agent다.
평가를 새로 작성하지 말고, evaluator가 만든 점수와 충분성 판단이 실제 answerText와 맞는지만 검사한다.
JSON만 반환한다.

검증 기준:
1. 점수 근거가 answerText에 실제로 있는가.
2. answerText에 없는 역할, 성과, 기술, 프로젝트를 근거로 삼지 않았는가.
3. retrievedEvidence를 답변 내용처럼 착각하지 않았는가.
4. 충분 답변 판단이 점수 기준과 additionalConditions와 일치하는가.
5. followUpFocus가 부족 사유와 맞는가.

반환 JSON:
{
  "valid": true,
  "confidence": 0.0-1.0,
  "reasons": ["문자열"],
  "retryInstruction": "재평가가 필요할 때 evaluator에게 줄 지시문"
}
""".strip()

    request_body = {
        "model": settings.OPENAI_JOB_ANALYSIS_MODEL,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "questionText": question_text,
                        "answerText": answer_text[:3500],
                        "jdText": jd_text[:5000],
                        "retrievedEvidence": retrieved_evidence,
                        "evaluation": evaluation,
                    },
                    ensure_ascii=False,
                ),
            },
        ],
        "temperature": 0.0,
    }

    try:
        with httpx.Client(timeout=OPENAI_TIMEOUT_SECONDS) as client:
            response = client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=request_body,
            )
            response.raise_for_status()
            data = response.json()
        return json.loads(data["choices"][0]["message"]["content"])
    except Exception:
        return None


def _normalize_validation(
    raw_result: dict[str, object],
    retry_count: int,
) -> EvaluationValidationResult:
    reasons = [
        str(item).strip()
        for item in raw_result.get("reasons", [])
        if str(item).strip()
    ][:5]
    confidence = max(0.0, min(float(raw_result.get("confidence", 0.0)), 1.0))
    valid = bool(raw_result.get("valid")) and confidence >= 0.55
    retry_instruction = str(raw_result.get("retryInstruction") or "").strip()
    if not retry_instruction and reasons:
        retry_instruction = "검증 실패 이유를 반영해 answerText에 있는 근거만 기준으로 보수적으로 다시 평가하세요."

    return EvaluationValidationResult(
        valid=valid,
        confidence=confidence,
        reasons=[] if valid else reasons,
        retryInstruction="" if valid else retry_instruction,
        retryCount=retry_count,
    )


def _heuristic_validation(
    evaluation: dict[str, object],
    answer_text: str,
    retry_count: int,
) -> EvaluationValidationResult:
    scores = dict(evaluation.get("scores", {}))
    conditions = dict(evaluation.get("additionalConditions", {}))
    total_score = int(scores.get("totalContentScore", 0))
    component_sum = sum(
        int(scores.get(key, 0))
        for key in [
            "questionRelevance",
            "specificity",
            "evidenceResult",
            "jobFit",
            "logicStructure",
            "authenticityAttitude",
        ]
    )
    answer_has_metric = bool(re.search(r"\d", answer_text))
    answer_has_result = any(token in answer_text for token in ["성과", "결과", "개선", "달성", "향상", "해결"])
    answer_has_role = any(token in answer_text for token in ["역할", "담당", "기여", "제가", "저는", "주도"])

    reasons: list[str] = []
    if abs(total_score - component_sum) > 3:
        reasons.append("세부 점수 합계와 totalContentScore가 일치하지 않습니다.")
    if int(scores.get("evidenceResult", 0)) >= 12 and not (answer_has_metric or answer_has_result):
        reasons.append("답변에 성과/결과 근거가 부족한데 evidenceResult 점수가 높습니다.")
    if bool(conditions.get("hasRole")) and not answer_has_role:
        reasons.append("답변에서 본인 역할 표현이 확인되지 않는데 hasRole이 true입니다.")
    if bool(evaluation.get("isSufficient")) and total_score < 70:
        reasons.append("내용 총점이 충분성 기준보다 낮은데 충분 답변으로 판단했습니다.")

    valid = not reasons
    confidence = 0.82 if valid else 0.48
    return EvaluationValidationResult(
        valid=valid,
        confidence=confidence,
        reasons=reasons,
        retryInstruction=(
            "" if valid else "answerText에 실제로 있는 역할, 성과, 직무 연결 근거만 사용해 보수적으로 다시 평가하세요."
        ),
        retryCount=retry_count,
    )

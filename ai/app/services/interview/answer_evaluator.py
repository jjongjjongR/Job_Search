import re
import json

import httpx

from app.schemas.common import InterviewAnswerType, InterviewQuestionType
from app.core.config import settings


FOLLOW_UP_PRIORITY_ORDER = [
    "role_contribution",
    "evidence_result",
    "job_fit",
    "technical_detail",
    "collaboration_attitude",
]

OPENAI_TIMEOUT_SECONDS = 20.0


def _request_openai_interview_evaluation(
    question_type: str,
    question_text: str,
    answer_text: str,
    jd_text: str,
    position_name: str,
) -> dict[str, object] | None:
    if not settings.OPENAI_API_KEY:
        return None

    system_prompt = """
너는 면접 답변 평가기다.
반드시 구조화된 JSON만 반환해라.

평가 기준:
- questionRelevance: 0~20
- specificity: 0~20
- evidenceResult: 0~15
- jobFit: 0~15
- logicStructure: 0~10
- authenticityAttitude: 0~5
- totalContentScore: 위 항목 합계, 0~85

충분성 기준:
- questionRelevance >= 15
- specificity >= 15
- jobFit >= 12
- totalContentScore >= 70
- 추가 조건 4개(hasRole, hasResult, hasJobLink, hasDetail) 중 3개 이상 true

꼬리질문 우선순위:
1. role_contribution
2. evidence_result
3. job_fit
4. technical_detail
5. collaboration_attitude

반환 JSON:
{
  "scores": {
    "questionRelevance": 0,
    "specificity": 0,
    "evidenceResult": 0,
    "jobFit": 0,
    "logicStructure": 0,
    "authenticityAttitude": 0,
    "totalContentScore": 0
  },
  "additionalConditions": {
    "hasRole": true,
    "hasResult": true,
    "hasJobLink": true,
    "hasDetail": true
  },
  "isSufficient": true,
  "insufficiencyReasons": ["문자열"],
  "followUpFocus": "role_contribution"
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
                        "questionType": question_type,
                        "questionText": question_text,
                        "answerText": answer_text,
                        "jdText": jd_text,
                        "positionName": position_name,
                    },
                    ensure_ascii=False,
                ),
            },
        ],
        "temperature": 0.1,
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
        parsed = json.loads(data["choices"][0]["message"]["content"])
        return _normalize_llm_evaluation(parsed)
    except Exception:
        return None


def _normalize_llm_evaluation(parsed: dict[str, object]) -> dict[str, object]:
    scores = dict(parsed.get("scores", {}))
    normalized_scores = {
        "questionRelevance": max(0, min(int(scores.get("questionRelevance", 0)), 20)),
        "specificity": max(0, min(int(scores.get("specificity", 0)), 20)),
        "evidenceResult": max(0, min(int(scores.get("evidenceResult", 0)), 15)),
        "jobFit": max(0, min(int(scores.get("jobFit", 0)), 15)),
        "logicStructure": max(0, min(int(scores.get("logicStructure", 0)), 10)),
        "authenticityAttitude": max(0, min(int(scores.get("authenticityAttitude", 0)), 5)),
        "totalContentScore": max(0, min(int(scores.get("totalContentScore", 0)), 85)),
    }
    conditions = dict(parsed.get("additionalConditions", {}))
    normalized_conditions = {
        "hasRole": bool(conditions.get("hasRole")),
        "hasResult": bool(conditions.get("hasResult")),
        "hasJobLink": bool(conditions.get("hasJobLink")),
        "hasDetail": bool(conditions.get("hasDetail")),
    }
    additional_pass_count = sum(1 for value in normalized_conditions.values() if value)
    insufficiency_reasons = [
        str(item).strip()
        for item in parsed.get("insufficiencyReasons", [])
        if str(item).strip()
    ][:5]
    follow_up_focus = str(parsed.get("followUpFocus") or "").strip() or None
    is_sufficient = (
        normalized_scores["questionRelevance"] >= 15
        and normalized_scores["specificity"] >= 15
        and normalized_scores["jobFit"] >= 12
        and normalized_scores["totalContentScore"] >= 70
        and additional_pass_count >= 3
    )
    return {
        "scores": normalized_scores,
        "additionalConditions": normalized_conditions,
        "additionalPassCount": additional_pass_count,
        "isSufficient": is_sufficient,
        "insufficiencyReasons": [] if is_sufficient else insufficiency_reasons,
        "followUpFocus": follow_up_focus,
    }


# 2026-04-15 신규: 답변 텍스트의 기본 품질을 보수적으로 계산
def evaluate_interview_answer(
    question_type: str,
    question_text: str,
    answer_text: str,
    jd_text: str,
    position_name: str,
) -> dict[str, object]:
    llm_result = _request_openai_interview_evaluation(
        question_type=question_type,
        question_text=question_text,
        answer_text=answer_text,
        jd_text=jd_text,
        position_name=position_name,
    )
    if llm_result:
        return llm_result

    cleaned_answer = re.sub(r"\s+", " ", answer_text).strip()
    lowered_answer = cleaned_answer.lower()
    lowered_question = question_text.lower()
    lowered_jd = jd_text.lower()
    answer_length = len(cleaned_answer)

    question_tokens = [
        token.lower()
        for token in re.findall(r"[A-Za-z][A-Za-z0-9.+#-]{1,}|[가-힣]{2,}", question_text)
        if len(token) >= 2
    ]
    jd_tokens = [
        token.lower()
        for token in re.findall(r"[A-Za-z][A-Za-z0-9.+#-]{1,}|[가-힣]{2,}", f"{position_name} {jd_text}")
        if len(token) >= 2
    ]

    question_hits = sum(1 for token in question_tokens[:6] if token in lowered_answer)
    jd_hits = sum(1 for token in jd_tokens[:10] if token in lowered_answer)
    has_metric = bool(re.search(r"\d", cleaned_answer))
    has_role = any(token in cleaned_answer for token in ["역할", "담당", "기여", "제가", "저는", "주도"])
    has_result = any(token in cleaned_answer for token in ["결과", "개선", "성과", "달성", "향상", "해결"])
    has_job_link = any(token in lowered_answer for token in jd_tokens[:8]) or any(
        signal in cleaned_answer for signal in ["직무", "업무", "포지션", "실무"]
    )
    has_detail = answer_length >= 110 and any(
        token in cleaned_answer for token in ["과정", "이유", "문제", "원인", "방법", "기준"]
    )
    has_structure = any(token in cleaned_answer for token in ["먼저", "이후", "그래서", "결과적으로", "당시"])
    has_attitude = any(token in cleaned_answer for token in ["협업", "소통", "책임", "배움", "개선"])
    intro_signals = any(
        token in cleaned_answer for token in ["안녕하세요", "지원", "경험", "강점", "역량"]
    )
    motivation_signals = any(
        token in cleaned_answer for token in ["지원한 이유", "지원 이유", "관심", "동기", "기여"]
    )

    # 2026-04-15 수정: 자기소개/지원동기 질문은 표현이 넓어서 질문 토큰 일치만으로 적합성을 판단하지 않도록 보정
    question_relevance = 8 + question_hits * 3
    if question_type == InterviewQuestionType.SELF_INTRO and intro_signals:
        question_relevance += 8
    elif question_type == InterviewQuestionType.MOTIVATION and motivation_signals:
        question_relevance += 7
    question_relevance = min(20, question_relevance)
    specificity = min(20, 7 + (6 if has_detail else 0) + (4 if answer_length >= 180 else 0) + (3 if has_metric else 0))
    evidence_result = min(15, 4 + (6 if has_result else 0) + (3 if has_metric else 0) + (2 if has_detail else 0))
    job_fit = min(15, 4 + min(jd_hits, 4) * 2 + (3 if has_job_link else 0))
    logic_structure = min(10, 4 + (4 if has_structure else 0) + (2 if answer_length >= 150 else 0))
    authenticity_attitude = min(5, 2 + (2 if has_attitude else 0) + (1 if "저" in cleaned_answer else 0))
    total_score = (
        question_relevance
        + specificity
        + evidence_result
        + job_fit
        + logic_structure
        + authenticity_attitude
    )

    additional_conditions = {
        "hasRole": has_role,
        "hasResult": has_result,
        "hasJobLink": has_job_link,
        "hasDetail": has_detail,
    }
    additional_pass_count = sum(1 for value in additional_conditions.values() if value)

    insufficiency_reasons: list[str] = []
    follow_up_focus = None
    if not has_role:
        insufficiency_reasons.append("본인 역할과 기여도가 분명하지 않습니다.")
        follow_up_focus = "role_contribution"
    if not has_result:
        insufficiency_reasons.append("성과나 근거 설명이 부족합니다.")
        follow_up_focus = follow_up_focus or "evidence_result"
    if not has_job_link:
        insufficiency_reasons.append("직무와의 연결이 약합니다.")
        follow_up_focus = follow_up_focus or "job_fit"
    if not has_detail:
        insufficiency_reasons.append("답변이 다소 추상적이라 구체적인 과정 설명이 더 필요합니다.")
        follow_up_focus = follow_up_focus or "technical_detail"
    if not has_attitude and question_type == InterviewQuestionType.COLLAB_PROBLEM_SOLVING:
        insufficiency_reasons.append("협업 과정에서의 태도나 소통 방식이 충분히 보이지 않습니다.")
        follow_up_focus = follow_up_focus or "collaboration_attitude"
    if question_relevance < 15:
        insufficiency_reasons.append("질문 의도에 직접 연결되는 핵심 답변이 약합니다.")
    if specificity < 15:
        insufficiency_reasons.append("구체성이 부족해 답변의 설득력이 떨어집니다.")
    if job_fit < 12:
        insufficiency_reasons.append("현재 답변만으로는 직무 적합성이 선명하지 않습니다.")

    is_sufficient = (
        question_relevance >= 15
        and specificity >= 15
        and job_fit >= 12
        and total_score >= 70
        and additional_pass_count >= 3
    )
    if is_sufficient:
        insufficiency_reasons = []

    return {
        "scores": {
            "questionRelevance": question_relevance,
            "specificity": specificity,
            "evidenceResult": evidence_result,
            "jobFit": job_fit,
            "logicStructure": logic_structure,
            "authenticityAttitude": authenticity_attitude,
            "totalContentScore": total_score,
        },
        "additionalConditions": additional_conditions,
        "additionalPassCount": additional_pass_count,
        "isSufficient": is_sufficient,
        "insufficiencyReasons": insufficiency_reasons[:5],
        "followUpFocus": follow_up_focus,
    }


# 2026-04-15 신규: 부족한 이유 우선순위에 맞는 꼬리질문 문장을 생성
def build_follow_up_question(
    focus: str | None,
    question_text: str,
) -> str:
    focus_to_question = {
        "role_contribution": "방금 사례에서 본인이 맡은 역할과 실제 기여도를 더 구체적으로 설명해 주세요.",
        "evidence_result": "그 경험의 성과를 수치나 결과 근거 중심으로 더 설명해 주세요.",
        "job_fit": "방금 경험이 지원 직무와 어떻게 연결되는지 한 번 더 구체적으로 말씀해 주세요.",
        "technical_detail": "문제를 어떻게 분석하고 어떤 기준으로 해결했는지 과정 중심으로 설명해 주세요.",
        "collaboration_attitude": "협업 과정에서 어떤 방식으로 소통하고 조율했는지 더 설명해 주세요.",
    }
    return focus_to_question.get(
        focus,
        f"{question_text}에 대해 조금 더 구체적인 근거를 덧붙여 설명해 주세요.",
    )


# 2026-04-15 신규: 비언어 평가는 12단계 이후 전 최소 기준으로만 반영
def build_nonverbal_summary(answer_type: str) -> tuple[str, int]:
    if answer_type == InterviewAnswerType.TEXT:
        return ("텍스트 답변으로 전환되어 비언어 평가는 반영하지 않았습니다.", 0)
    return ("현재 단계에서는 큰 장해 요소가 없다고 보고 기본 비언어 점수를 반영했습니다.", 8)

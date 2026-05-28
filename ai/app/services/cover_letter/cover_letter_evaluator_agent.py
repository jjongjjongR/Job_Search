import re

from app.schemas.cover_letter import (
    CoverLetterFeedbackRequest,
    CoverLetterRubricScore,
)
from app.services.cover_letter.shared import (
    fill_to_three,
    request_openai_json,
    score_question,
)


OPENAI_EVALUATOR_PROMPT = """
너는 채용 자소서 평가 전문가다.
중요 원칙은 "정답 문장을 미리 정해놓고 채점하지 않는 것"이다.
항상 아래 순서로 평가해라.
1. 서버가 전달한 JD 요구사항과 requirementEvaluations를 먼저 읽는다.
2. strong/partial/weak/none 판단 결과를 바탕으로 설명만 작성한다.
3. 부족한 점은 "이 공고 기준에서 왜 부족한지" 설명한다.

반드시 지켜라:
- 특정 회사나 문항의 정답을 외우듯 평가하지 마라.
- 입력으로 들어온 JD와 문서에 실제로 있는 근거만 사용해라.
- 최종 점수와 rubric은 서버가 RAG 근거와 고정 기준으로 계산한다.
- 너는 점수를 새로 만들지 말고, 서버가 계산한 평가를 설명하는 문장만 작성해라.
- 직무 미스매치, JD 반영 부족, 문항 요구와의 거리, 역할 설명 부족은 분명히 감점하라.
- 문항별 점수는 각 문항 본문만 보고 매겨라.
- retrievedEvidence에 있는 근거 chunk를 우선 사용해라.
- evidenceText는 가능하면 retrievedEvidence 안 문장을 그대로 사용해라.
- summary에는 "경험 재료는 좋지만 무엇을 더 보완해야 하는지"를 짧게 요약해라.

반환 JSON 형식:
{
  "summary": "문자열",
  "strengths": ["문자열", "문자열", "문자열"],
  "weaknesses": ["문자열", "문자열", "문자열"],
  "revisionDirections": ["문자열", "문자열", "문자열"],
  "nextActions": ["문자열", "문자열", "문자열"]
}
""".strip()

OPENAI_EVIDENCE_JUDGE_PROMPT = """
너는 JD 요구사항과 지원자 문서 근거의 연결 강도를 판단하는 evidence judge agent다.
최종 점수는 만들지 않는다. 각 요구사항에 대해 근거 강도만 분류한다.

판단 기준:
- strong: 요구사항과 직접 연결되고, 본인 역할/기술/성과 중 2개 이상이 분명하다.
- partial: 요구사항과 연결되지만 구체성, 역할, 성과 중 일부가 부족하다.
- weak: 관련 단어는 있으나 실제 경험 근거가 약하다.
- none: 지원자 문서에서 확인할 수 없다.

반드시 지켜라:
- evidenceText는 coverLetter, resume, portfolio, retrievedEvidence 안에 실제로 있는 문장만 사용해라.
- JD 원문 문장을 지원자 경험 근거처럼 쓰지 마라.
- 숫자 점수는 절대 만들지 마라.
- 모르면 none으로 둔다.

반환 JSON:
{
  "requirementEvaluations": [
    {
      "requirementId": "REQ_1",
      "evidenceStrength": "strong 또는 partial 또는 weak 또는 none",
      "evidenceText": "지원자 문서에 실제로 있는 근거 문장",
      "evidenceSource": "coverLetter 또는 resume 또는 portfolio",
      "reason": "왜 그렇게 판단했는지 짧은 설명"
    }
  ]
}
""".strip()


RUBRIC_DEFINITION = [
    ("JD 반영도", 25),
    ("직무 적합도", 25),
    ("경험 구체성", 20),
    ("성과/근거", 15),
    ("문항 적합성", 10),
    ("문장 완성도", 5),
]

STRENGTH_FACTORS = {
    "strong": 1.0,
    "partial": 0.65,
    "weak": 0.35,
    "none": 0.0,
}


def _source_text_for(
    evidence_source: str,
    evidence_context: dict[str, object],
    jd_context: dict[str, object],
) -> str:
    documents = evidence_context["documents"]
    source_key = evidence_source.strip()
    if source_key == "JD":
        return str(jd_context["jdText"])
    if source_key == "resume":
        return str(documents["resumeText"])
    if source_key == "portfolio":
        return str(documents["portfolioText"])
    return str(documents["coverLetterText"])


def _verify_evidence(evidence_text: str, source_text: str) -> bool:
    cleaned_evidence = re.sub(r"\s+", " ", evidence_text).strip()
    cleaned_source = re.sub(r"\s+", " ", source_text).strip()
    if not cleaned_evidence or not cleaned_source:
        return False
    if cleaned_evidence in cleaned_source:
        return True
    evidence_tokens = {
        token.lower()
        for token in re.findall(r"[A-Za-z][A-Za-z0-9.+#-]{1,}|[가-힣]{2,}", cleaned_evidence)
    }
    source_lower = cleaned_source.lower()
    hit_count = sum(1 for token in evidence_tokens if token in source_lower)
    return bool(evidence_tokens) and hit_count / len(evidence_tokens) >= 0.6


def _build_rubric_scores(
    raw_items: list[dict],
    evidence_context: dict[str, object],
    jd_context: dict[str, object],
) -> tuple[list[CoverLetterRubricScore], float]:
    normalized: list[CoverLetterRubricScore] = []
    raw_by_category = {
        str(item.get("category", "")).strip(): item for item in raw_items if isinstance(item, dict)
    }

    for category, max_score in RUBRIC_DEFINITION:
        raw_item = raw_by_category.get(category, {})
        score = max(0, min(int(raw_item.get("score", max_score * 0.55)), max_score))
        evidence_text = str(raw_item.get("evidenceText") or "").strip()
        evidence_source = str(raw_item.get("evidenceSource") or "coverLetter").strip()
        verified = _verify_evidence(
            evidence_text=evidence_text,
            source_text=_source_text_for(evidence_source, evidence_context, jd_context),
        )
        if not verified:
            score = max(0, score - max(2, round(max_score * 0.2)))
            if not evidence_text:
                evidence_text = "검증 가능한 근거 문장이 부족합니다."

        normalized.append(
            CoverLetterRubricScore(
                category=category,
                score=score,
                maxScore=max_score,
                evidenceText=evidence_text,
                evidenceSource=evidence_source,
                verified=verified,
            )
        )

    verified_count = sum(1 for item in normalized if item.verified)
    confidence = 0.45 + verified_count / len(normalized) * 0.45
    return normalized, round(min(confidence, 0.95), 2)


def _build_fallback_rubric_scores(
    evidence_context: dict[str, object],
    jd_context: dict[str, object],
) -> tuple[list[CoverLetterRubricScore], float]:
    documents = evidence_context["documents"]
    cover_letter_text = str(documents["coverLetterText"])
    resume_text = str(documents["resumeText"])
    portfolio_text = str(documents["portfolioText"])
    keyword_hits = int(evidence_context["keywordHits"])
    has_metric = bool(re.search(r"\d", str(evidence_context["combinedText"])))

    raw_items = [
        {
            "category": "JD 반영도",
            "score": min(25, 10 + keyword_hits * 3),
            "evidenceText": ", ".join(list(jd_context["jdKeywords"])[:3]),
            "evidenceSource": "JD",
        },
        {
            "category": "직무 적합도",
            "score": min(25, 9 + keyword_hits * 3),
            "evidenceText": resume_text[:120] or cover_letter_text[:120],
            "evidenceSource": "resume" if resume_text else "coverLetter",
        },
        {
            "category": "경험 구체성",
            "score": 16 if len(cover_letter_text) >= 220 else 11,
            "evidenceText": cover_letter_text[:120],
            "evidenceSource": "coverLetter",
        },
        {
            "category": "성과/근거",
            "score": 12 if has_metric else 7,
            "evidenceText": cover_letter_text[:120],
            "evidenceSource": "coverLetter",
        },
        {
            "category": "문항 적합성",
            "score": 8,
            "evidenceText": cover_letter_text[:120],
            "evidenceSource": "coverLetter",
        },
        {
            "category": "문장 완성도",
            "score": 4,
            "evidenceText": portfolio_text[:120] or cover_letter_text[:120],
            "evidenceSource": "portfolio" if portfolio_text else "coverLetter",
        },
    ]
    return _build_rubric_scores(raw_items, evidence_context, jd_context)


def _sum_rubric_total(rubric_scores: list[CoverLetterRubricScore]) -> int:
    return sum(item.score for item in rubric_scores)


def _priority_weight(priority: str) -> float:
    normalized = priority.strip().lower()
    if normalized == "high":
        return 1.35
    if normalized == "low":
        return 0.75
    return 1.0


def _weighted_strength_average(requirement_evaluations: list[dict[str, object]]) -> float:
    total_weight = 0.0
    weighted_sum = 0.0
    for item in requirement_evaluations:
        weight = float(item.get("weight", 1.0))
        factor = float(item.get("factor", 0.0))
        total_weight += weight
        weighted_sum += factor * weight
    if total_weight <= 0:
        return 0.0
    return max(0.0, min(weighted_sum / total_weight, 1.0))


def _best_requirement_evaluation(
    requirement_evaluations: list[dict[str, object]],
) -> dict[str, object]:
    if not requirement_evaluations:
        return {
            "evidenceText": "검증 가능한 근거 문장이 부족합니다.",
            "evidenceSource": "coverLetter",
            "verified": False,
        }
    return max(
        requirement_evaluations,
        key=lambda item: (
            float(item.get("factor", 0.0)),
            1 if bool(item.get("verified")) else 0,
        ),
    )


def _requirement_evidence_source_text(
    evidence_source: str,
    evidence_context: dict[str, object],
) -> str:
    documents = evidence_context["documents"]
    source_key = evidence_source.strip()
    if source_key == "resume":
        return str(documents["resumeText"])
    if source_key == "portfolio":
        return str(documents["portfolioText"])
    return str(documents["coverLetterText"])


def _first_matching_document_evidence(
    requirement: dict[str, object],
    evidence_context: dict[str, object],
) -> tuple[str, str, bool]:
    documents = evidence_context["documents"]
    keywords = [
        str(keyword).strip()
        for keyword in requirement.get("keywords", [])
        if str(keyword).strip()
    ]
    sources = [
        ("coverLetter", str(documents["coverLetterText"])),
        ("resume", str(documents["resumeText"])),
        ("portfolio", str(documents["portfolioText"])),
    ]
    for source, text in sources:
        if not text.strip():
            continue
        lowered_text = text.lower()
        if any(keyword.lower() in lowered_text for keyword in keywords):
            return text[:160], source, True
    for evidence in evidence_context["rag"].get("retrievedEvidence", []):
        source = str(evidence.get("source", "coverLetter"))
        if source == "JD":
            continue
        text = str(evidence.get("text", ""))
        lowered_text = text.lower()
        if any(keyword.lower() in lowered_text for keyword in keywords):
            return text[:160], source, True
    return "검증 가능한 근거 문장이 부족합니다.", "coverLetter", False


def _fallback_requirement_evaluations(
    requirements: list[dict[str, object]],
    evidence_context: dict[str, object],
) -> list[dict[str, object]]:
    combined_text = str(evidence_context["combinedText"])
    lowered_combined = combined_text.lower()
    evaluations: list[dict[str, object]] = []
    has_metric = bool(re.search(r"\d", combined_text))
    has_role_detail = any(signal in combined_text for signal in ["역할", "담당", "제가", "저는"])

    for requirement in requirements:
        keywords = [
            str(keyword).strip()
            for keyword in requirement.get("keywords", [])
            if str(keyword).strip()
        ]
        hit_count = sum(1 for keyword in keywords if keyword.lower() in lowered_combined)
        evidence_text, evidence_source, verified = _first_matching_document_evidence(
            requirement,
            evidence_context,
        )
        if hit_count >= 2 and (has_metric or has_role_detail):
            strength = "strong"
        elif hit_count >= 1:
            strength = "partial"
        elif verified:
            strength = "weak"
        else:
            strength = "none"
        factor = STRENGTH_FACTORS[strength]
        evaluations.append(
            {
                "requirementId": requirement.get("id"),
                "name": requirement.get("name"),
                "priority": requirement.get("priority", "medium"),
                "weight": _priority_weight(str(requirement.get("priority", "medium"))),
                "evidenceStrength": strength,
                "factor": factor,
                "evidenceText": evidence_text,
                "evidenceSource": evidence_source,
                "verified": verified,
                "reason": "지원자 문서에서 요구사항 키워드와 경험 근거를 규칙 기반으로 확인했습니다.",
            }
        )
    return evaluations


def _normalize_requirement_evaluations(
    raw_result: dict | None,
    requirements: list[dict[str, object]],
    evidence_context: dict[str, object],
) -> tuple[list[dict[str, object]], str]:
    fallback = _fallback_requirement_evaluations(requirements, evidence_context)
    fallback_by_id = {
        str(item.get("requirementId")): item
        for item in fallback
    }
    raw_items = []
    if isinstance(raw_result, dict):
        raw_items = raw_result.get("requirementEvaluations", [])
    if not isinstance(raw_items, list):
        return fallback, "HEURISTIC_REQUIREMENT_JUDGE"
    if not raw_items:
        return fallback, "HEURISTIC_REQUIREMENT_JUDGE"

    raw_by_id = {
        str(item.get("requirementId", "")).strip(): item
        for item in raw_items
        if isinstance(item, dict)
    }
    normalized: list[dict[str, object]] = []
    for requirement in requirements:
        requirement_id = str(requirement.get("id"))
        fallback_item = fallback_by_id.get(requirement_id, {})
        raw_item = raw_by_id.get(requirement_id, {})
        strength = str(
            raw_item.get("evidenceStrength")
            or fallback_item.get("evidenceStrength")
            or "none"
        ).strip().lower()
        if strength not in STRENGTH_FACTORS:
            strength = "none"
        evidence_text = str(
            raw_item.get("evidenceText")
            or fallback_item.get("evidenceText")
            or ""
        ).strip()
        evidence_source = str(
            raw_item.get("evidenceSource")
            or fallback_item.get("evidenceSource")
            or "coverLetter"
        ).strip()
        if evidence_source == "JD":
            evidence_source = "coverLetter"

        verified = _verify_evidence(
            evidence_text=evidence_text,
            source_text=_requirement_evidence_source_text(evidence_source, evidence_context),
        )
        if not verified:
            fallback_text = str(fallback_item.get("evidenceText") or "").strip()
            fallback_source = str(fallback_item.get("evidenceSource") or "coverLetter")
            fallback_verified = bool(fallback_item.get("verified"))
            if fallback_verified:
                evidence_text = fallback_text
                evidence_source = fallback_source
                verified = True
            else:
                evidence_text = "검증 가능한 근거 문장이 부족합니다."
                strength = "none"

        factor = STRENGTH_FACTORS[strength]
        normalized.append(
            {
                "requirementId": requirement_id,
                "name": requirement.get("name"),
                "priority": requirement.get("priority", "medium"),
                "weight": _priority_weight(str(requirement.get("priority", "medium"))),
                "evidenceStrength": strength,
                "factor": factor,
                "evidenceText": evidence_text,
                "evidenceSource": evidence_source,
                "verified": verified,
                "reason": str(
                    raw_item.get("reason")
                    or fallback_item.get("reason")
                    or "요구사항과 지원자 문서 근거의 연결 강도를 확인했습니다."
                ).strip(),
            }
        )

    if not normalized:
        return fallback, "HEURISTIC_REQUIREMENT_JUDGE"
    return normalized, "OPENAI_REQUIREMENT_JUDGE"


def _rubric_item(
    category: str,
    score: int,
    max_score: int,
    evidence: dict[str, object],
) -> CoverLetterRubricScore:
    return CoverLetterRubricScore(
        category=category,
        score=max(0, min(score, max_score)),
        maxScore=max_score,
        evidenceText=str(evidence.get("evidenceText") or "검증 가능한 근거 문장이 부족합니다."),
        evidenceSource=str(evidence.get("evidenceSource") or "coverLetter"),
        verified=bool(evidence.get("verified")),
    )


def _build_requirement_rubric_scores(
    requirement_evaluations: list[dict[str, object]],
    evidence_context: dict[str, object],
    question_scores: list[object],
) -> tuple[list[CoverLetterRubricScore], float]:
    coverage_factor = _weighted_strength_average(requirement_evaluations)
    high_priority_evaluations = [
        item
        for item in requirement_evaluations
        if str(item.get("priority", "")).lower() == "high"
    ] or requirement_evaluations
    core_factor = _weighted_strength_average(high_priority_evaluations)
    best_evidence = _best_requirement_evaluation(requirement_evaluations)
    verified_count = sum(1 for item in requirement_evaluations if bool(item.get("verified")))
    verified_ratio = verified_count / max(1, len(requirement_evaluations))

    combined_text = str(evidence_context["combinedText"])
    has_metric = bool(re.search(r"\d", combined_text))
    has_role_detail = any(signal in combined_text for signal in ["역할", "담당", "제가", "저는"])
    has_action = any(
        signal in combined_text
        for signal in ["분석", "개선", "설계", "최적화", "구축", "검증", "해결", "적용"]
    )
    detail_factor = min(
        1.0,
        0.35
        + (0.2 if len(combined_text) >= 500 else 0.0)
        + (0.2 if has_role_detail else 0.0)
        + (0.15 if has_action else 0.0)
        + (0.1 if has_metric else 0.0),
    )
    result_factor = min(1.0, 0.35 + (0.35 if has_metric else 0.0) + coverage_factor * 0.3)
    question_factor = (
        sum(int(getattr(item, "score", 0)) for item in question_scores)
        / max(1, len(question_scores))
        / 100
    )
    writing_factor = min(1.0, 0.55 + (0.25 if len(combined_text) >= 500 else 0.0) + (0.2 if has_role_detail else 0.0))

    rubric_scores = [
        _rubric_item("JD 반영도", round(25 * coverage_factor), 25, best_evidence),
        _rubric_item("직무 적합도", round(25 * core_factor), 25, _best_requirement_evaluation(high_priority_evaluations)),
        _rubric_item(
            "경험 구체성",
            round(20 * (coverage_factor * 0.55 + detail_factor * 0.45)),
            20,
            best_evidence,
        ),
        _rubric_item(
            "성과/근거",
            round(15 * result_factor),
            15,
            best_evidence,
        ),
        _rubric_item(
            "문항 적합성",
            round(10 * min(1.0, question_factor)),
            10,
            best_evidence,
        ),
        _rubric_item("문장 완성도", round(5 * writing_factor), 5, best_evidence),
    ]
    confidence = 0.4 + verified_ratio * 0.35 + coverage_factor * 0.2
    return rubric_scores, round(min(confidence, 0.95), 2)


def _requirement_strength_lists(
    requirement_evaluations: list[dict[str, object]],
) -> tuple[list[str], list[str], list[str], list[str]]:
    strong_items = [
        str(item.get("name"))
        for item in requirement_evaluations
        if item.get("evidenceStrength") == "strong"
    ]
    partial_items = [
        str(item.get("name"))
        for item in requirement_evaluations
        if item.get("evidenceStrength") == "partial"
    ]
    weak_items = [
        str(item.get("name"))
        for item in requirement_evaluations
        if item.get("evidenceStrength") in {"weak", "none"}
    ]

    strengths = [
        f"{name} 요구사항과 연결되는 근거가 확인됩니다."
        for name in strong_items[:3]
    ]
    if partial_items:
        strengths.append(f"{partial_items[0]} 관련 경험 재료가 있어 보완하면 활용할 수 있습니다.")

    weaknesses = [
        f"{name} 요구사항은 근거가 약하거나 직접 연결이 부족합니다."
        for name in weak_items[:3]
    ]
    revision_directions = [
        f"{name} 경험을 본인 역할, 사용 기술, 결과 순서로 보강해 보세요."
        for name in [*weak_items, *partial_items][:3]
    ]
    next_actions = [
        f"{name}을 보여주는 문장을 자소서 문단 앞쪽에 추가해 보세요."
        for name in [*weak_items, *partial_items][:3]
    ]
    return strengths, weaknesses, revision_directions, next_actions


def _build_server_evaluation(
    payload: CoverLetterFeedbackRequest,
    jd_context: dict[str, object],
    evidence_context: dict[str, object],
    requirement_evaluations: list[dict[str, object]] | None = None,
    requirement_judge_source: str = "HEURISTIC_REQUIREMENT_JUDGE",
) -> dict[str, object]:
    question_inputs = list(evidence_context["questionInputs"])
    question_scores = [
        score_question(
            question_number=int(question["questionNumber"]),
            title=str(question["title"]),
            body=str(question["body"]),
            jd_keywords=list(jd_context["jdKeywords"]),
            job_focus_keywords=list(jd_context["jobFocusKeywords"]),
        )
        for question in question_inputs
    ]
    requirements = [
        item
        for item in jd_context.get("requirements", [])
        if isinstance(item, dict)
    ]
    requirement_evaluations = requirement_evaluations or _fallback_requirement_evaluations(
        requirements,
        evidence_context,
    )
    rubric_scores, confidence = _build_requirement_rubric_scores(
        requirement_evaluations,
        evidence_context,
        question_scores,
    )
    total_score = _sum_rubric_total(rubric_scores)
    jd_alignment_score = round(rubric_scores[0].score / rubric_scores[0].maxScore * 100)
    job_fit_score = round(rubric_scores[1].score / rubric_scores[1].maxScore * 100)
    strengths, weaknesses, revision_directions, next_actions = _requirement_strength_lists(
        requirement_evaluations,
    )

    revision_directions = fill_to_three(
        revision_directions,
        [
            "문항마다 본인 역할, 행동, 결과 순서가 보이게 다시 정리해 보세요.",
            "직무와 연결되는 기술 키워드를 문단 앞쪽에 배치해 보세요.",
            "성과 문장은 수치 중심 표현으로 더 짧고 강하게 바꿔 보세요.",
        ],
    )
    next_actions = fill_to_three(
        next_actions,
        [
            "문단 마지막마다 지원 직무와 연결되는 한 문장을 추가해 보세요.",
            "프로젝트별 역할과 사용 기술을 분리해서 적어 보세요.",
            "강점 문장을 결과 중심 표현으로 다시 다듬어 보세요.",
        ],
    )

    return {
        "source": (
            "HEURISTIC"
            if requirement_judge_source == "HEURISTIC_REQUIREMENT_JUDGE"
            else requirement_judge_source
        ),
        "totalScore": total_score,
        "jdAlignmentScore": min(jd_alignment_score, 95),
        "jobFitScore": min(job_fit_score, 95),
        "confidence": confidence,
        "verifiedJdKeywords": list(jd_context["jdKeywords"]),
        "requirementEvaluations": requirement_evaluations,
        "rubricScores": rubric_scores,
        "retrievedEvidence": evidence_context["rag"]["retrievedEvidence"],
        "summary": (
            f"{payload.jobAnalysis.companyName} {payload.jobAnalysis.positionName} 기준으로 보면 "
            "경험 재료는 나쁘지 않지만, JD 연결과 역할 설명을 더 선명하게 보여줄 필요가 있습니다."
        ),
        "questionScores": question_scores,
        "strengths": fill_to_three(
            strengths,
            [
                "입력 문서 안에서 JD와 연결되는 경험 근거가 일부 확인됩니다.",
                "성과나 역할 설명이 들어 있어 설득력 있는 문장을 만들 재료가 있습니다.",
                "문항 구조가 완전히 무너지지 않아 다듬을 기반은 갖춰져 있습니다.",
            ],
        ),
        "weaknesses": fill_to_three(
            weaknesses,
            [
                "본인 역할과 선택 이유가 더 구체적으로 드러나야 합니다.",
                "직무 연결 문장이 부족해 강점이 덜 선명해 보입니다.",
                "핵심 성과를 수치와 결과로 더 분명히 적을 필요가 있습니다.",
            ],
        ),
        "revisionDirections": revision_directions,
        "nextActions": next_actions,
    }


# 2026-04-21 신규: JD와 지원자 근거를 바탕으로 점수와 피드백을 만드는 평가 agent
def run_cover_letter_evaluator_agent(
    payload: CoverLetterFeedbackRequest,
    jd_context: dict[str, object],
    evidence_context: dict[str, object],
    validation_feedback: str | None = None,
) -> dict[str, object]:
    question_inputs = list(evidence_context["questionInputs"])
    requirements = [
        item
        for item in jd_context.get("requirements", [])
        if isinstance(item, dict)
    ]
    evidence_judge_result = request_openai_json(
        OPENAI_EVIDENCE_JUDGE_PROMPT,
        {
            "jobAnalysis": {
                "companyName": jd_context["companyName"],
                "positionName": jd_context["positionName"],
                "jdText": jd_context["jdText"],
                "requirements": requirements,
            },
            "documents": evidence_context["documents"],
            "retrievedEvidence": evidence_context["rag"]["retrievedEvidence"],
            "validationFeedback": validation_feedback or "",
        },
    )
    requirement_evaluations, requirement_judge_source = _normalize_requirement_evaluations(
        evidence_judge_result,
        requirements,
        evidence_context,
    )
    server_evaluation = _build_server_evaluation(
        payload,
        jd_context,
        evidence_context,
        requirement_evaluations,
        requirement_judge_source,
    )
    openai_result = request_openai_json(
        OPENAI_EVALUATOR_PROMPT,
        {
            "jobAnalysis": {
                "companyName": jd_context["companyName"],
                "positionName": jd_context["positionName"],
                "jdText": jd_context["jdText"],
                "jdKeywords": jd_context["jdKeywords"],
                "jobFocusKeywords": jd_context["jobFocusKeywords"],
                "requirements": requirements,
            },
            "documents": evidence_context["documents"],
            "questionInputs": question_inputs,
            "retrievedEvidence": evidence_context["rag"]["retrievedEvidence"],
            "requirementEvaluations": requirement_evaluations,
            "serverScore": {
                "totalScore": server_evaluation["totalScore"],
                "jdAlignmentScore": server_evaluation["jdAlignmentScore"],
                "jobFitScore": server_evaluation["jobFitScore"],
                "confidence": server_evaluation["confidence"],
            },
            "validationFeedback": validation_feedback or "",
        },
    )

    if isinstance(openai_result, dict) and openai_result:
        def normalize_items(key: str, fallback: list[str]) -> list[str]:
            values = [
                str(item).strip()
                for item in openai_result.get(key, [])
                if str(item).strip()
            ]
            return fill_to_three(values, fallback)

        return {
            **server_evaluation,
            "source": f"{server_evaluation['source']}+OPENAI_TEXT",
            "summary": str(
                openai_result.get("summary")
                or server_evaluation["summary"]
            ).strip(),
            "strengths": normalize_items(
                "strengths",
                list(server_evaluation["strengths"]),
            ),
            "weaknesses": normalize_items(
                "weaknesses",
                list(server_evaluation["weaknesses"]),
            ),
            "revisionDirections": normalize_items(
                "revisionDirections",
                list(server_evaluation["revisionDirections"]),
            ),
            "nextActions": normalize_items(
                "nextActions",
                list(server_evaluation["nextActions"]),
            ),
        }

    return server_evaluation

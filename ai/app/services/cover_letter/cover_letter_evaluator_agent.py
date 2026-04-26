import re

from app.schemas.cover_letter import (
    CoverLetterFeedbackRequest,
    CoverLetterQuestionScore,
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
1. JD와 직무명에서 요구 역량, 핵심 역할, 우대 역량을 먼저 추출한다.
2. 자소서/이력서/포트폴리오에서 그 요구와 연결되는 근거를 찾는다.
3. 연결된 근거가 얼마나 구체적인지, 수치/성과/역할 설명이 있는지 평가한다.
4. 부족한 점은 "이 공고 기준에서 왜 부족한지" 설명한다.

반드시 지켜라:
- 특정 회사나 문항의 정답을 외우듯 평가하지 마라.
- 입력으로 들어온 JD와 문서에 실제로 있는 근거만 사용해라.
- 점수는 보수적으로 매겨라. 제출 직전 수준이 아니면 90점 이상을 주지 마라.
- 직무 미스매치, JD 반영 부족, 문항 요구와의 거리, 역할 설명 부족은 분명히 감점하라.
- 문항별 점수는 각 문항 본문만 보고 매겨라.
- retrievedEvidence에 있는 근거 chunk를 우선 사용해라.
- evidenceText는 가능하면 retrievedEvidence 안 문장을 그대로 사용해라.
- summary에는 "경험 재료는 좋지만 무엇을 더 보완해야 하는지"를 짧게 요약해라.

반환 JSON 형식:
{
  "jdAlignmentScore": 0-100 정수,
  "jobFitScore": 0-100 정수,
  "totalScore": 0-100 정수,
  "summary": "문자열",
  "strengths": ["문자열", "문자열", "문자열"],
  "weaknesses": ["문자열", "문자열", "문자열"],
  "revisionDirections": ["문자열", "문자열", "문자열"],
  "nextActions": ["문자열", "문자열", "문자열"],
  "rubricScores": [
    {
      "category": "JD 반영도",
      "score": 0-25 정수,
      "maxScore": 25,
      "evidenceText": "실제 입력 문서에 있는 근거 문장",
      "evidenceSource": "coverLetter 또는 resume 또는 portfolio"
    }
  ],
  "questionScores": [
    {
      "questionNumber": 정수,
      "title": "문항 제목",
      "score": 0-100 정수,
      "feedback": "이 문항의 강약점을 한두 문장으로 설명"
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


# 2026-04-21 신규: JD와 지원자 근거를 바탕으로 점수와 피드백을 만드는 평가 agent
def run_cover_letter_evaluator_agent(
    payload: CoverLetterFeedbackRequest,
    jd_context: dict[str, object],
    evidence_context: dict[str, object],
) -> dict[str, object]:
    question_inputs = list(evidence_context["questionInputs"])
    openai_result = request_openai_json(
        OPENAI_EVALUATOR_PROMPT,
        {
            "jobAnalysis": {
                "companyName": jd_context["companyName"],
                "positionName": jd_context["positionName"],
                "jdText": jd_context["jdText"],
                "jdKeywords": jd_context["jdKeywords"],
                "jobFocusKeywords": jd_context["jobFocusKeywords"],
            },
            "documents": evidence_context["documents"],
            "questionInputs": question_inputs,
            "retrievedEvidence": evidence_context["rag"]["retrievedEvidence"],
        },
    )

    if openai_result:
        rubric_scores, confidence = _build_rubric_scores(
            list(openai_result.get("rubricScores", [])),
            evidence_context,
            jd_context,
        )
        total_score = max(40, min(_sum_rubric_total(rubric_scores), 89))
        question_scores = [
            CoverLetterQuestionScore(
                questionNumber=int(item.get("questionNumber", index + 1)),
                title=str(item.get("title") or f"문항 {index + 1}"),
                score=max(0, min(int(item.get("score", 0)), 100)),
                feedback=str(
                    item.get("feedback") or "문항별 피드백이 생성되지 않았습니다."
                ),
            )
            for index, item in enumerate(openai_result.get("questionScores", []))
        ]

        def normalize_items(key: str, fallback: list[str]) -> list[str]:
            values = [
                str(item).strip()
                for item in openai_result.get(key, [])
                if str(item).strip()
            ]
            return fill_to_three(values, fallback)

        return {
            "source": "OPENAI",
            "totalScore": total_score,
            "jdAlignmentScore": max(
                35, min(int(openai_result.get("jdAlignmentScore", 0)), 95)
            ),
            "jobFitScore": max(35, min(int(openai_result.get("jobFitScore", 0)), 95)),
            "confidence": confidence,
            "verifiedJdKeywords": list(jd_context["jdKeywords"]),
            "rubricScores": rubric_scores,
            "retrievedEvidence": evidence_context["rag"]["retrievedEvidence"],
            "summary": str(
                openai_result.get("summary")
                or "입력된 JD와 지원자 문서를 기준으로 보수적으로 평가한 결과입니다."
            ).strip(),
            "questionScores": question_scores,
            "strengths": normalize_items(
                "strengths",
                [
                    "입력 문서 안에서 JD와 연결되는 경험 근거가 일부 확인됩니다.",
                    "성과나 역할 설명이 들어 있어 설득력 있는 문장을 만들 재료가 있습니다.",
                    "이력서와 자소서를 함께 보면 경험 흐름을 정리하기 좋습니다.",
                ],
            ),
            "weaknesses": normalize_items(
                "weaknesses",
                [
                    "JD 요구사항과 문항 내용의 직접 연결이 더 선명해야 합니다.",
                    "본인 역할과 선택 이유를 더 구체적으로 설명할 필요가 있습니다.",
                    "직무 기준에서 어떤 강점인지 문장으로 더 명확히 드러내야 합니다.",
                ],
            ),
            "revisionDirections": normalize_items(
                "revisionDirections",
                [
                    "각 문항 끝에 지원 직무와 연결되는 한 문장을 추가해 보세요.",
                    "성과 수치와 본인 역할을 분리해서 더 분명히 적어 보세요.",
                    "JD 핵심 요구와 맞는 경험만 앞쪽에 배치해 보세요.",
                ],
            ),
            "nextActions": normalize_items(
                "nextActions",
                [
                    "문항별 핵심 메시지를 한 줄로 먼저 정리해 보세요.",
                    "직무 적합성을 보여주는 경험을 문단 첫머리에 배치해 보세요.",
                    "프로젝트 결과를 수치 중심 표현으로 다시 다듬어 보세요.",
                ],
            ),
        }

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
    rubric_scores, confidence = _build_fallback_rubric_scores(
        evidence_context,
        jd_context,
    )
    total_score = _sum_rubric_total(rubric_scores)
    metric_hits = bool(re.search(r"\d", str(evidence_context["combinedText"])))
    total_score = min(total_score + (4 if evidence_context["hasResume"] else 0), 88)
    jd_alignment_score = min(
        95,
        45 + int(evidence_context["keywordHits"]) * 8 + (5 if metric_hits else 0),
    )
    job_fit_score = min(
        93,
        42
        + int(evidence_context["keywordHits"]) * 6
        + (6 if evidence_context["hasPortfolio"] else 0),
    )

    strengths: list[str] = []
    weaknesses: list[str] = []
    revision_directions: list[str] = []
    next_actions: list[str] = []

    if evidence_context["keywordHits"] >= 3:
        strengths.append("JD 핵심 키워드가 자소서와 이력서에 비교적 잘 반영되어 있습니다.")
    else:
        weaknesses.append("JD 핵심 요구와 직접 맞닿는 표현이 아직 부족합니다.")
        revision_directions.append("문항마다 JD 용어를 그대로 가져와 연결 문장을 추가해 보세요.")

    if metric_hits:
        strengths.append("숫자나 성과 근거가 보여서 설득력이 생깁니다.")
    else:
        weaknesses.append("성과 수치나 결과 근거가 부족해 설득력이 약해집니다.")
        next_actions.append("각 경험에서 수치와 결과를 한 줄씩 더 보강해 보세요.")

    if evidence_context["hasResume"] or evidence_context["hasPortfolio"]:
        strengths.append("추가 문서가 함께 있어 경험을 교차 검증하기 좋습니다.")
    else:
        weaknesses.append("자소서 외 보조 문서가 없어 경험 근거가 좁게 보일 수 있습니다.")
        next_actions.append("이력서나 포트폴리오 핵심 내용을 함께 붙여 근거를 넓혀 보세요.")

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
        "source": "HEURISTIC",
        "totalScore": max(48, total_score),
        "jdAlignmentScore": max(40, jd_alignment_score),
        "jobFitScore": max(38, job_fit_score),
        "confidence": confidence,
        "verifiedJdKeywords": list(jd_context["jdKeywords"]),
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

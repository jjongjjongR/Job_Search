from app.schemas.cover_letter import CoverLetterFeedbackRequest
from app.services.cover_letter.shared import (
    extract_job_focus_keywords,
    extract_keywords,
    request_openai_json,
)


OPENAI_JD_ANALYZER_PROMPT = """
너는 채용공고를 평가 기준으로 바꾸는 JD analyzer agent다.
목표는 단어 목록을 만드는 것이 아니라, 자소서 평가에 사용할 요구사항을 안정적으로 추출하는 것이다.

반드시 지켜라:
- JD 원문에 실제로 있는 요구사항만 추출해라.
- 붙어서 봐야 하는 표현은 쪼개지 마라. 예: Fine tuning, Forward Deployed Engineer, 문제 해결, 데이터 분석.
- 회사 소개 문구, 복지, 지원 방법, 근무 조건은 평가 기준에서 제외해라.
- 너무 세밀하게 쪼개지 말고 핵심 요구사항 4~7개로 압축해라.
- 각 요구사항은 지원자 문서에서 어떤 근거를 찾을지 evidenceNeeded로 설명해라.
- 점수는 만들지 마라. priority와 maxScore는 서버가 최종 점수로 다시 환산하기 위한 기준값이다.

반환 JSON:
{
  "requirements": [
    {
      "id": "REQ_1",
      "name": "요구사항 이름",
      "category": "기술 역량 또는 직무 적합도 또는 문제 해결 또는 협업/태도",
      "priority": "high 또는 medium 또는 low",
      "maxScore": 10-25 정수,
      "evidenceNeeded": "지원자 문서에서 확인할 근거",
      "sourceText": "JD 원문에 실제로 있는 근거 문장 또는 구절",
      "keywords": ["붙어서 봐야 하는 키워드"]
    }
  ]
}
""".strip()

PRIORITY_DEFAULT_MAX_SCORE = {
    "high": 20,
    "medium": 15,
    "low": 10,
}


def _safe_int(value: object, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


# 2026-04-21 신규: AI/규칙이 뽑은 JD 키워드가 실제 JD 원문에 있는지 검증
def _verify_keyword_in_jd(keyword: str, jd_text: str) -> bool:
    return keyword.strip().lower() in jd_text.lower()


def _verify_source_text_in_jd(source_text: str, jd_text: str) -> bool:
    normalized_source = " ".join(source_text.strip().split()).lower()
    normalized_jd = " ".join(jd_text.strip().split()).lower()
    if not normalized_source or not normalized_jd:
        return False
    if normalized_source in normalized_jd:
        return True
    source_tokens = {
        token.lower()
        for token in extract_keywords(source_text, limit=8)
        if len(token.strip()) >= 2
    }
    if not source_tokens:
        return False
    return sum(1 for token in source_tokens if token in normalized_jd) / len(source_tokens) >= 0.6


def _priority_of(index: int) -> str:
    if index <= 2:
        return "high"
    if index <= 5:
        return "medium"
    return "low"


def _category_for(keyword: str) -> str:
    lowered = keyword.lower()
    if any(signal in lowered for signal in ["python", "llm", "rag", "api", "fastapi", "redis"]):
        return "기술 역량"
    if any(signal in keyword for signal in ["문제", "분석", "해결", "최적화", "개선"]):
        return "문제 해결"
    if any(signal in keyword for signal in ["협업", "동료", "소통"]):
        return "협업/태도"
    return "직무 적합도"


def _dedupe_keywords_preserving_phrases(keywords: list[str]) -> list[str]:
    unique_keywords = list(dict.fromkeys(keyword for keyword in keywords if keyword.strip()))
    filtered: list[str] = []
    for keyword in unique_keywords:
        keyword_lower = keyword.lower()
        is_contained_by_phrase = any(
            keyword_lower != other.lower()
            and len(other) > len(keyword)
            and keyword_lower in other.lower()
            for other in unique_keywords
        )
        if not is_contained_by_phrase:
            filtered.append(keyword)
    return filtered


def _fallback_requirements(
    position_name: str,
    jd_text: str,
    jd_keywords: list[str],
    focus_keywords: list[str],
) -> list[dict[str, object]]:
    merged_keywords: list[str] = []
    for keyword in [*focus_keywords, *jd_keywords]:
        if keyword and keyword not in merged_keywords:
            merged_keywords.append(keyword)

    requirements: list[dict[str, object]] = []
    for index, keyword in enumerate(merged_keywords[:7], start=1):
        priority = _priority_of(index)
        requirements.append(
            {
                "id": f"REQ_{index}",
                "name": f"{keyword} 관련 역량",
                "category": _category_for(keyword),
                "priority": priority,
                "maxScore": PRIORITY_DEFAULT_MAX_SCORE[priority],
                "evidenceNeeded": f"{keyword}를 실제 프로젝트나 업무에서 사용한 경험",
                "sourceText": keyword,
                "keywords": [keyword],
            }
        )

    if not requirements and position_name:
        requirements.append(
            {
                "id": "REQ_1",
                "name": f"{position_name} 직무 이해도",
                "category": "직무 적합도",
                "priority": "high",
                "maxScore": 20,
                "evidenceNeeded": f"{position_name} 직무와 연결되는 경험",
                "sourceText": jd_text[:120] or position_name,
                "keywords": extract_keywords(position_name, limit=4),
            }
        )
    return requirements


def _normalize_requirements(
    raw_result: dict | None,
    fallback_requirements: list[dict[str, object]],
    jd_text: str,
) -> tuple[list[dict[str, object]], str]:
    raw_requirements = []
    if isinstance(raw_result, dict):
        raw_requirements = raw_result.get("requirements", [])

    normalized: list[dict[str, object]] = []
    if isinstance(raw_requirements, list):
        for item in raw_requirements:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name") or "").strip()
            source_text = str(item.get("sourceText") or "").strip()
            if not name:
                continue
            if source_text and not _verify_source_text_in_jd(source_text, jd_text):
                source_text = ""

            priority = str(item.get("priority") or "medium").strip().lower()
            if priority not in PRIORITY_DEFAULT_MAX_SCORE:
                priority = "medium"
            keywords = [
                str(keyword).strip()
                for keyword in item.get("keywords", [])
                if str(keyword).strip()
            ]
            keywords = [
                keyword
                for keyword in [*keywords, *extract_keywords(f"{name} {source_text}", limit=4)]
                if keyword
            ]
            deduped_keywords = _dedupe_keywords_preserving_phrases(keywords)[:6]

            normalized.append(
                {
                    "id": f"REQ_{len(normalized) + 1}",
                    "name": name[:80],
                    "category": str(item.get("category") or "직무 적합도").strip()[:40],
                    "priority": priority,
                    "maxScore": max(
                        10,
                        min(
                            _safe_int(
                                item.get("maxScore"),
                                PRIORITY_DEFAULT_MAX_SCORE[priority],
                            ),
                            25,
                        ),
                    ),
                    "evidenceNeeded": str(item.get("evidenceNeeded") or f"{name} 경험").strip()[:160],
                    "sourceText": source_text or name,
                    "keywords": deduped_keywords or [name],
                }
            )
            if len(normalized) >= 7:
                break

    if len(normalized) < 3:
        return fallback_requirements, "HEURISTIC"
    return normalized, "OPENAI_REQUIREMENTS"


# 2026-04-21 신규: JD에서 평가 기준 키워드와 직무 초점을 분리해 추출하는 agent
def run_jd_analyzer_agent(payload: CoverLetterFeedbackRequest) -> dict[str, object]:
    jd_text = payload.jobAnalysis.jdText.strip()
    position_name = payload.jobAnalysis.positionName.strip()
    raw_keywords = extract_keywords(jd_text, limit=10)
    raw_focus_keywords = extract_job_focus_keywords(position_name, jd_text)
    verified_jd_keywords = [
        keyword for keyword in raw_keywords if _verify_keyword_in_jd(keyword, jd_text)
    ]
    verified_focus_keywords = [
        keyword
        for keyword in raw_focus_keywords
        if _verify_keyword_in_jd(keyword, jd_text)
        or keyword.strip().lower() in position_name.lower()
    ]
    fallback_requirements = _fallback_requirements(
        position_name,
        jd_text,
        verified_jd_keywords,
        verified_focus_keywords,
    )
    openai_result = request_openai_json(
        OPENAI_JD_ANALYZER_PROMPT,
        {
            "companyName": payload.jobAnalysis.companyName.strip(),
            "positionName": position_name,
            "jdText": jd_text,
            "verifiedKeywordCandidates": verified_jd_keywords,
            "focusKeywordCandidates": verified_focus_keywords,
        },
    )
    requirements, requirement_source = _normalize_requirements(
        openai_result,
        fallback_requirements,
        jd_text,
    )
    requirement_keywords = list(
        dict.fromkeys(
            keyword
            for requirement in requirements
            for keyword in list(requirement.get("keywords", []))
            if str(keyword).strip()
        )
    )

    return {
        "companyName": payload.jobAnalysis.companyName.strip(),
        "positionName": position_name,
        "jdText": jd_text,
        "jdKeywords": list(dict.fromkeys([*requirement_keywords, *verified_jd_keywords]))[:12],
        "jobFocusKeywords": verified_focus_keywords,
        "requirements": requirements,
        "requirementSource": requirement_source,
        "rejectedJdKeywords": [
            keyword for keyword in raw_keywords if keyword not in verified_jd_keywords
        ],
    }

# ai/app/services/jobs/analyze_service.py
# 공고 분석 더미 응답을 반환하는 서비스 파일

import re
from urllib.parse import urlparse

from app.schemas.jobs import JobAnalyzeRequest, JobAnalyzeResponse

PRIORITY_KEYWORDS = [
    "NestJS",
    "FastAPI",
    "PostgreSQL",
    "Redis",
    "Python",
    "TypeScript",
    "Node.js",
    "AWS",
    "Docker",
    "Kubernetes",
    "REST",
    "SQL",
    "Git",
    "Linux",
    "백엔드",
    "서버",
    "API",
    "데이터베이스",
]

PRIORITY_SKILLS = [
    "NestJS",
    "FastAPI",
    "PostgreSQL",
    "Redis",
    "Python",
    "TypeScript",
    "Node.js",
    "AWS",
    "Docker",
    "Kubernetes",
]

STOPWORDS = {
    "and",
    "with",
    "for",
    "the",
    "this",
    "that",
    "using",
    "경험",
    "우대",
    "채용",
    "모집",
    "개발",
    "업무",
    "지원",
    "관련",
    "기반",
    "능력",
}


# 2026-04-10 신규: URL 슬러그를 사람이 읽을 수 있는 이름으로 정리
def _humanize_slug(value: str | None, fallback: str) -> str:
    if not value:
        return fallback

    cleaned = re.sub(r"[-_]+", " ", value).strip()
    if not cleaned:
        return fallback

    return " ".join(part.capitalize() for part in cleaned.split())


# 2026-04-10 신규: JD 본문에서 재사용 가능한 키워드를 추출
def _extract_keywords(jd_text: str) -> list[str]:
    lowered_text = jd_text.lower()
    keywords: list[str] = []

    for keyword in PRIORITY_KEYWORDS:
        if keyword.lower() in lowered_text and keyword not in keywords:
            keywords.append(keyword)

    for token in re.findall(r"[A-Za-z][A-Za-z0-9.+#-]{1,}|[가-힣]{2,}", jd_text):
        normalized = token.strip()
        if normalized.lower() in STOPWORDS:
            continue
        if normalized not in keywords:
            keywords.append(normalized)
        if len(keywords) >= 8:
            break

    return keywords


# 2026-04-10 신규: JD 본문에서 핵심 기술명을 별도로 추출
def _extract_skills(jd_text: str) -> list[str]:
    lowered_text = jd_text.lower()
    return [
        skill for skill in PRIORITY_SKILLS if skill.lower() in lowered_text
    ][:6]


# 2026-04-10 신규: URL 기반 공고 정보를 현재 단계에서 규칙 기반으로 정리
def _build_url_analysis(payload: JobAnalyzeRequest) -> JobAnalyzeResponse | None:
    if not payload.jobUrl:
        return None

    parsed = urlparse(payload.jobUrl)
    if not parsed.netloc:
        return None

    host_parts = [part for part in parsed.netloc.split(".") if part and part != "www"]
    path_parts = [part for part in parsed.path.split("/") if part]

    company_name = payload.manualCompanyName or _humanize_slug(
        host_parts[0] if host_parts else None,
        "Unknown Company",
    )
    position_name = payload.manualJobTitle or payload.manualPositionName or _humanize_slug(
        path_parts[-1] if path_parts else None,
        "General Position",
    )
    jd_text = payload.manualJdText or (
        f"{company_name}의 {position_name} 채용 공고입니다. "
        "백엔드 API 개발, 데이터 처리, 협업 경험을 중요하게 봅니다."
    )
    extracted_skills = _extract_skills(jd_text)
    extracted_keywords = _extract_keywords(jd_text)

    return JobAnalyzeResponse(
        companyName=company_name,
        positionName=position_name,
        jdText=jd_text,
        extractedSkills=extracted_skills,
        extractedKeywords=extracted_keywords,
        keywords=extracted_keywords,
        sourceType="JOB_POSTING_URL",
        status="COMPLETED",
    )


# 2026-04-10 수정: URL 분석 실패 시 수동 입력으로 fallback 하도록 공고 분석 로직 보강
def analyze_job_service(payload: JobAnalyzeRequest) -> JobAnalyzeResponse:
    url_analysis = _build_url_analysis(payload)
    if url_analysis:
        return url_analysis

    company_name = payload.manualCompanyName or "Unknown Company"
    position_name = (
        payload.manualJobTitle or payload.manualPositionName or "General Position"
    )
    jd_text = payload.manualJdText or (
        f"{company_name}의 {position_name} 관련 일반 공고입니다."
    )
    extracted_skills = _extract_skills(jd_text)
    extracted_keywords = _extract_keywords(jd_text)

    return JobAnalyzeResponse(
        companyName=company_name,
        positionName=position_name,
        jdText=jd_text,
        extractedSkills=extracted_skills,
        extractedKeywords=extracted_keywords,
        keywords=extracted_keywords,
        sourceType="MANUAL",
        status="COMPLETED",
    )

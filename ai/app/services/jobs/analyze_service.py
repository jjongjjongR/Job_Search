# ai/app/services/jobs/analyze_service.py
# 공고 분석 더미 응답을 반환하는 서비스 파일

import json
import re
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException

from app.core.config import settings
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

DOMAIN_COMPANY_MAP = {
    "kakao": "카카오",
    "careers.kakao": "카카오",
    "openai": "OpenAI",
}

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

OPENAI_TIMEOUT_SECONDS = 20.0
MAX_SOURCE_TEXT_LENGTH = 12000


def _pick_job_url(payload: JobAnalyzeRequest) -> str | None:
    return (payload.jobUrl or payload.jobPostingUrl or "").strip() or None


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


# 2026-04-11 신규: HTML에서 공고 본문으로 볼 만한 텍스트만 남기기
def _strip_html(html: str) -> str:
    cleaned = re.sub(r"(?is)<script.*?>.*?</script>", " ", html)
    cleaned = re.sub(r"(?is)<style.*?>.*?</style>", " ", cleaned)
    cleaned = re.sub(r"(?i)<br\s*/?>", "\n", cleaned)
    cleaned = re.sub(r"(?i)</p>|</div>|</li>|</section>|</article>|</h\d>", "\n", cleaned)
    cleaned = re.sub(r"(?is)<[^>]+>", " ", cleaned)
    cleaned = re.sub(r"&nbsp;", " ", cleaned)
    cleaned = re.sub(r"&amp;", "&", cleaned)
    cleaned = re.sub(r"\n\s*\n+", "\n\n", cleaned)
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    return cleaned.strip()


# 2026-04-11 신규: URL에서 실제 공고 페이지 내용을 가져오기
def _fetch_job_posting_text(job_url: str) -> str | None:
    try:
        with httpx.Client(
            follow_redirects=True,
            timeout=OPENAI_TIMEOUT_SECONDS,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Safari/537.36"
                )
            },
        ) as client:
            response = client.get(job_url)
            response.raise_for_status()
            html = response.text
            text = _strip_html(html)

            # 2026-04-11 신규: CSR 껍데기 페이지일 때를 대비해 meta/script 안의 구조화 텍스트도 함께 수집
            candidate_chunks: list[str] = []

            # 2026-04-11 신규: 일반 본문 텍스트를 우선 후보에 포함
            if text:
                candidate_chunks.append(text)

            # 2026-04-11 신규: 메타 description/og 설명에 공고 핵심이 들어있는 경우를 수집
            for meta_pattern in [
                r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)["\']',
                r'<meta[^>]+property=["\']og:description["\'][^>]+content=["\']([^"\']+)["\']',
                r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)["\']',
            ]:
                for match in re.findall(meta_pattern, html, re.IGNORECASE):
                    cleaned_meta = _strip_html(match)
                    if cleaned_meta:
                        candidate_chunks.append(cleaned_meta)

            # 2026-04-11 신규: JSON-LD나 __NEXT_DATA__ 같은 구조화 데이터에서 공고 텍스트를 재귀 수집
            def collect_json_strings(value: object) -> list[str]:
                collected: list[str] = []
                if isinstance(value, dict):
                    for nested_value in value.values():
                        collected.extend(collect_json_strings(nested_value))
                elif isinstance(value, list):
                    for item in value:
                        collected.extend(collect_json_strings(item))
                elif isinstance(value, str):
                    normalized = value.strip()
                    if len(normalized) >= 20 and any(
                        keyword in normalized
                        for keyword in [
                            "업무",
                            "지원자격",
                            "우대사항",
                            "자격",
                            "기술",
                            "경험",
                            "모집",
                            "Search",
                            "Machine Learning",
                            "Python",
                            "TensorFlow",
                            "PyTorch",
                            "RAG",
                        ]
                    ):
                        collected.append(normalized)
                return collected

            for script_match in re.findall(
                r"<script[^>]*>(.*?)</script>",
                html,
                re.IGNORECASE | re.DOTALL,
            ):
                script_body = script_match.strip()
                if not script_body:
                    continue

                json_candidates = [script_body]
                next_data_match = re.search(
                    r"__NEXT_DATA__\s*=\s*(\{.*\})",
                    script_body,
                    re.DOTALL,
                )
                if next_data_match:
                    json_candidates.append(next_data_match.group(1))

                for json_candidate in json_candidates:
                    try:
                        parsed_json = json.loads(json_candidate)
                    except Exception:
                        continue

                    candidate_chunks.extend(collect_json_strings(parsed_json))

            merged_text = "\n".join(
                chunk.strip()
                for chunk in candidate_chunks
                if chunk and "enable javascript" not in chunk.lower()
            ).strip()

            # 2026-04-11 수정: JS 실행 안내문만 보이는 껍데기 페이지는 분석 본문으로 쓰지 않음
            shell_indicators = [
                "javascript를 활성화",
                "enable javascript",
                "this app works best with javascript",
            ]
            if merged_text and not any(indicator in merged_text.lower() for indicator in shell_indicators):
                return merged_text[:MAX_SOURCE_TEXT_LENGTH]

            # 2026-04-11 신규: JS 렌더링 사이트는 Jina Reader를 통해 본문 텍스트를 한 번 더 시도
            reader_response = client.get(f"https://r.jina.ai/http://{job_url}")
            reader_response.raise_for_status()
            reader_text = reader_response.text.strip()
            if reader_text and not any(
                indicator in reader_text.lower() for indicator in shell_indicators
            ):
                return reader_text[:MAX_SOURCE_TEXT_LENGTH]
            return None
    except Exception:
        return None


# 2026-04-11 신규: GPT-4o-mini로 공고 본문을 구조화 분석
def _analyze_with_openai(
    source_text: str,
    payload: JobAnalyzeRequest,
) -> JobAnalyzeResponse | None:
    if not settings.OPENAI_API_KEY:
        return None

    system_prompt = """
    너는 채용 공고 분석기다.
    입력된 채용 공고 텍스트를 읽고 아래 JSON만 반환해라.
    - companyName: 회사명
    - positionName: 직무명
    - jdText: 사용자에게 보여줄 수 있게 정리한 JD 본문 요약
    - jobCategory: BACKEND, FRONTEND, AI_ML, DATA, MOBILE, DEVOPS, FULLSTACK, GENERAL_TECH 중 하나
    - extractedSkills: 기술명 배열
    - extractedKeywords: 핵심 키워드 배열
    - sourceType: JOB_POSTING_URL 또는 MANUAL
    - status: COMPLETED

    규칙:
    1. 직무명은 가장 구체적인 채용 포지션명으로 적는다.
    2. 회사명은 추정이 아니라 공고 본문에 근거해 적는다. 없으면 URL/수동 입력을 참고한다.
    3. jdText는 공고 핵심 내용을 8~12줄 정도의 자연스러운 한국어로 정리한다.
    4. 먼저 jobCategory를 정확히 분류한 뒤, 그 직무군 기준으로 기술을 뽑는다.
    5. extractedSkills는 기술 스택, 프레임워크, 언어, 도구, 모델명만 넣고 추상어는 넣지 마라.
    6. extractedKeywords는 역할, 도메인, 업무 주제, 평가/프로세스 키워드를 넣는다.
    7. 우대사항에 적힌 기술도 중요한 분석 대상이므로 extractedSkills에 적극 반영한다.
    8. 사용자가 직접 입력한 JD가 더 구체적이면 그 내용을 우선 반영한다.
    9. AI_ML 공고를 백엔드로 바꾸지 말고, FRONTEND 공고를 백엔드로 바꾸지 말고, DATA 공고를 AI_ML로 바꾸지 마라.
    10. 예시:
    - BACKEND: Java, Kotlin, Spring, NestJS, Node.js, FastAPI, PostgreSQL, Redis, Kafka
    - FRONTEND: React, Next.js, TypeScript, JavaScript, Vue, HTML, CSS, Tailwind
    - AI_ML: Python, PyTorch, TensorFlow, RAG, Embedding, Reranker, Vector Search, Fine-tuning
    - DATA: SQL, Spark, Airflow, dbt, Hadoop, Python, ETL, BigQuery
    - MOBILE: Android, iOS, Kotlin, Swift, Flutter, React Native
    - DEVOPS: Docker, Kubernetes, AWS, GCP, Terraform, ArgoCD, CI/CD
    """.strip()

    user_prompt = {
        "jobUrl": _pick_job_url(payload),
        "manualCompanyName": payload.manualCompanyName,
        "manualJobTitle": payload.manualJobTitle or payload.manualPositionName,
        "manualJdText": payload.manualJdText,
        "sourceText": source_text[:MAX_SOURCE_TEXT_LENGTH],
    }

    request_body = {
        "model": settings.OPENAI_JOB_ANALYSIS_MODEL,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": json.dumps(user_prompt, ensure_ascii=False),
            },
        ],
        "temperature": 0.2,
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
            content = data["choices"][0]["message"]["content"]
            parsed = json.loads(content)

        company_name = parsed.get("companyName") or payload.manualCompanyName
        position_name = (
            parsed.get("positionName")
            or payload.manualJobTitle
            or payload.manualPositionName
        )
        jd_text = parsed.get("jdText") or payload.manualJdText or source_text[:2000]
        extracted_skills = [
            str(item).strip()
            for item in parsed.get("extractedSkills", [])
            if str(item).strip()
        ][:8]
        extracted_keywords = [
            str(item).strip()
            for item in parsed.get("extractedKeywords", [])
            if str(item).strip()
        ][:10]

        analysis_basis_text = (
            payload.manualJdText.strip()
            if payload.manualJdText and payload.manualJdText.strip()
            else "\n".join(part for part in [source_text, jd_text] if part)
        )
        role_catalog = {
            "BACKEND": [
                "Java",
                "Kotlin",
                "Spring",
                "NestJS",
                "Node.js",
                "Express",
                "FastAPI",
                "Django",
                "Flask",
                "PostgreSQL",
                "MySQL",
                "Redis",
                "Kafka",
                "MongoDB",
                "REST",
                "GraphQL",
            ],
            "FRONTEND": [
                "React",
                "Next.js",
                "TypeScript",
                "JavaScript",
                "Vue",
                "Nuxt",
                "HTML",
                "CSS",
                "Tailwind",
                "Webpack",
                "Vite",
            ],
            "AI_ML": [
                "Python",
                "PyTorch",
                "TensorFlow",
                "RAG",
                "Embedding",
                "Reranker",
                "Vector Search",
                "Dense Retrieval",
                "Late-interaction",
                "Ranking",
                "Fine-tuning",
                "Quantization",
                "Distillation",
                "Inference Optimization",
                "NLP",
                "LLM",
                "Semantic Search",
                "Elasticsearch",
                "Opensearch",
            ],
            "DATA": [
                "Python",
                "SQL",
                "Spark",
                "Airflow",
                "dbt",
                "Hadoop",
                "BigQuery",
                "Redshift",
                "Snowflake",
                "ETL",
                "ELT",
                "Pandas",
            ],
            "MOBILE": [
                "Android",
                "iOS",
                "Kotlin",
                "Swift",
                "Flutter",
                "React Native",
                "Jetpack Compose",
                "SwiftUI",
            ],
            "DEVOPS": [
                "Docker",
                "Kubernetes",
                "AWS",
                "GCP",
                "Azure",
                "Terraform",
                "ArgoCD",
                "CI/CD",
                "Jenkins",
                "GitHub Actions",
                "Prometheus",
                "Grafana",
            ],
            "FULLSTACK": [
                "React",
                "Next.js",
                "TypeScript",
                "Node.js",
                "NestJS",
                "JavaScript",
                "PostgreSQL",
                "Redis",
                "Docker",
            ],
            "GENERAL_TECH": [
                "Python",
                "Java",
                "TypeScript",
                "JavaScript",
                "SQL",
                "Docker",
                "AWS",
                "Git",
            ],
        }
        inferred_category = str(parsed.get("jobCategory") or "").strip().upper()
        normalized_category = (
            inferred_category if inferred_category in role_catalog else "GENERAL_TECH"
        )
        preferred_skill_candidates = role_catalog[normalized_category]

        # 2026-04-11 수정: Java/JavaScript 같은 오탐을 막기 위해 기술명을 단순 부분문자열이 아니라 경계 기반으로 검사
        def skill_exists(skill: str, text: str) -> bool:
            escaped_skill = re.escape(skill)
            if re.search(rf"(?<![A-Za-z0-9]){escaped_skill}(?![A-Za-z0-9])", text, re.IGNORECASE):
                return True
            return skill.lower() in text.lower().split()

        merged_skills: list[str] = []
        for skill in extracted_skills:
            if skill_exists(skill, analysis_basis_text) and skill not in merged_skills:
                merged_skills.append(skill)
        for skill in preferred_skill_candidates:
            if skill_exists(skill, analysis_basis_text) and skill not in merged_skills:
                merged_skills.append(skill)
        for skill_group in role_catalog.values():
            for skill in skill_group:
                if skill_exists(skill, analysis_basis_text) and skill not in merged_skills:
                    merged_skills.append(skill)

        merged_keywords: list[str] = []
        for keyword in extracted_keywords:
            if keyword not in merged_keywords:
                merged_keywords.append(keyword)
        for keyword in merged_skills:
            if keyword not in merged_keywords:
                merged_keywords.append(keyword)

        if not company_name or not position_name or not jd_text:
            return None

        return JobAnalyzeResponse(
            companyName=company_name,
            positionName=position_name,
            jdText=jd_text,
            extractedSkills=merged_skills[:10] or _extract_skills(jd_text),
            extractedKeywords=merged_keywords[:12] or _extract_keywords(jd_text),
            keywords=merged_keywords[:12] or _extract_keywords(jd_text),
            sourceType="JOB_POSTING_URL" if _pick_job_url(payload) else "MANUAL",
            status="COMPLETED",
        )
    except Exception:
        return None


# 2026-04-11 신규: JD 첫 줄에서 직무명을 우선 추출
def _infer_position_from_jd(jd_text: str) -> str | None:
    for raw_line in jd_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if len(line) < 6:
            continue
        if line.startswith(("◆", "#")):
            continue
        if any(marker in line for marker in ["업무내용", "지원자격", "우대사항", "지원프로세스"]):
            continue
        if len(line) <= 80:
            return line
    return None


# 2026-04-11 신규: JD 본문과 URL에서 회사명을 더 자연스럽게 추론
def _infer_company_name(payload: JobAnalyzeRequest, host_parts: list[str]) -> str:
    if payload.manualCompanyName:
        return payload.manualCompanyName

    jd_text = payload.manualJdText or ""
    for company in ["카카오", "네이버", "라인", "쿠팡", "토스", "배달의민족", "당근", "OpenAI"]:
        if company in jd_text:
            return company

    dotted_host = ".".join(host_parts[:2]) if host_parts else ""
    if dotted_host in DOMAIN_COMPANY_MAP:
        return DOMAIN_COMPANY_MAP[dotted_host]

    if host_parts and host_parts[0] in DOMAIN_COMPANY_MAP:
        return DOMAIN_COMPANY_MAP[host_parts[0]]

    return _humanize_slug(host_parts[0] if host_parts else None, "Unknown Company")


# 2026-04-11 신규: 수동 JD 본문이 있으면 URL 슬러그보다 JD 직무명을 우선 사용
def _infer_position_name(payload: JobAnalyzeRequest, path_parts: list[str]) -> str:
    if payload.manualJobTitle:
        return payload.manualJobTitle
    if payload.manualPositionName:
        return payload.manualPositionName

    jd_position = _infer_position_from_jd(payload.manualJdText or "")
    if jd_position:
        return jd_position

    return _humanize_slug(
        path_parts[-1] if path_parts else None,
        "General Position",
    )


# 2026-04-10 신규: URL 기반 공고 정보를 현재 단계에서 규칙 기반으로 정리
def _build_url_analysis(payload: JobAnalyzeRequest) -> JobAnalyzeResponse | None:
    job_url = _pick_job_url(payload)
    if not job_url:
        return None

    parsed = urlparse(job_url)
    if not parsed.netloc:
        return None

    fetched_text = _fetch_job_posting_text(job_url)
    # 2026-04-11 수정: URL 본문이 빈약해도 사용자가 넣은 JD 핵심 내용을 함께 분석하도록 병합
    if fetched_text and payload.manualJdText:
        llm_source_text = (
            "[URL에서 수집한 공고 본문]\n"
            f"{fetched_text}\n\n"
            "[사용자가 입력한 JD 본문]\n"
            f"{payload.manualJdText}"
        )[:MAX_SOURCE_TEXT_LENGTH]
    else:
        llm_source_text = (fetched_text or payload.manualJdText or "")[:MAX_SOURCE_TEXT_LENGTH]
    if llm_source_text:
        llm_analysis = _analyze_with_openai(llm_source_text, payload)
        if llm_analysis:
            return llm_analysis

    # 2026-04-11 수정: URL 본문도 없고 수동 JD도 없으면 추정 성공 응답을 만들지 않음
    if not fetched_text and not payload.manualJdText:
        return None

    host_parts = [part for part in parsed.netloc.split(".") if part and part != "www"]
    path_parts = [part for part in parsed.path.split("/") if part]

    company_name = _infer_company_name(payload, host_parts)
    position_name = _infer_position_name(payload, path_parts)
    jd_text = payload.manualJdText or fetched_text
    if not jd_text:
        return None
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
    if payload.manualJdText and settings.OPENAI_API_KEY:
        llm_analysis = _analyze_with_openai(payload.manualJdText, payload)
        if llm_analysis:
            return llm_analysis

    url_analysis = _build_url_analysis(payload)
    if url_analysis:
        return url_analysis

    # 2026-04-11 수정: URL만으로 본문 추출에 실패한 경우 가짜 성공 응답 대신 명확한 실패를 반환
    if _pick_job_url(payload) and not payload.manualJdText:
        raise HTTPException(
            status_code=422,
            detail="공고 URL에서 실제 본문을 추출하지 못했습니다. JD 본문을 함께 입력해주세요.",
        )

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

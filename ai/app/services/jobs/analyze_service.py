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
    "Java",
    "Kotlin",
    "Go",
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
    "RESTful",
    "gRPC",
    "REST",
    "SQL",
    "Git",
    "Linux",
    "SDV",
    "커넥티드 카",
    "마이크로서비스",
    "글로벌 서비스 게이트웨이",
    "자동화 관제",
    "실시간 알림",
    "지능형 모니터링",
    "무선통신 디바이스",
    "5G",
    "6G",
    "백엔드",
    "서버",
    "API",
    "데이터베이스",
]

PRIORITY_SKILLS = [
    "Java",
    "Kotlin",
    "Go",
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
    "RESTful",
    "gRPC",
    "5G",
    "6G",
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
    "경력",
    "신입",
    "무관",
    "회사",
    "직무",
    "공고",
    "복지",
    "혜택",
    "지역",
    "근무",
    "정규직",
    "계약직",
}

GENERIC_JD_KEYWORDS = {
    "경력",
    "신입",
    "무관",
    "회사",
    "직무",
    "공고",
    "복지",
    "혜택",
    "지역",
    "근무",
    "정규직",
    "계약직",
}

OPENAI_TIMEOUT_SECONDS = 20.0
MAX_SOURCE_TEXT_LENGTH = 12000

JD_SECTION_MARKERS = ["조직소개", "직무상세", "지원자격", "우대사항", "수행업무"]
GENERIC_SUMMARY_MARKERS = ["성장 기회", "다양한 혜택", "혁신적인 솔루션", "글로벌 기업"]
JD_DETAIL_SIGNALS = [
    "직무상세",
    "지원자격",
    "우대사항",
    "주요업무",
    "담당업무",
    "자격요건",
    "RESTful",
    "gRPC",
    "트래픽",
    "백엔드",
    "마이크로서비스",
    "통신",
    "커넥티드",
]

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
        if normalized in GENERIC_JD_KEYWORDS:
            continue
        # 2026-05-06 수정: 일반 문장 일부가 키워드로 저장되지 않도록 종결/조사형 토큰 제외
        if normalized.endswith(("합니다", "습니다", "입니다", "에서", "에게", "으로", "자는")):
            continue
        if normalized not in keywords:
            keywords.append(normalized)
        if len(keywords) >= 8:
            break

    return keywords


# 2026-05-05 신규: 공고 본문이 아닌 사이드바/필터에서 나온 일반 키워드를 결과에서 제거
def _sanitize_keywords(keywords: list[str], basis_text: str) -> list[str]:
    sanitized: list[str] = []
    for raw_keyword in keywords:
        keyword = str(raw_keyword).strip()
        if not keyword:
            continue
        if keyword in GENERIC_JD_KEYWORDS or keyword.lower() in STOPWORDS:
            continue
        if keyword not in basis_text and keyword not in PRIORITY_KEYWORDS:
            continue
        if keyword not in sanitized:
            sanitized.append(keyword)
    return sanitized


# 2026-05-06 신규: LLM이 뽑은 키워드를 원문 근거가 있는 항목만 남기는 guardrail
def _normalize_llm_terms(
    terms: list[object],
    basis_text: str,
    limit: int,
) -> list[str]:
    normalized_terms: list[str] = []
    lowered_basis_text = basis_text.lower()

    for raw_term in terms:
        term = re.sub(r"\s+", " ", str(raw_term)).strip()
        if not term:
            continue
        if term in GENERIC_JD_KEYWORDS or term.lower() in STOPWORDS:
            continue
        if term.lower() not in lowered_basis_text:
            continue
        if term not in normalized_terms:
            normalized_terms.append(term)
        if len(normalized_terms) >= limit:
            break

    return normalized_terms


# 2026-05-06 신규: 실제 JD 본문을 못 읽은 LLM 추정 결과를 성공으로 저장하지 않기 위한 품질 게이트
def _is_substantive_jd_text(jd_text: str) -> bool:
    normalized_text = re.sub(r"\s+", " ", jd_text).strip()
    if len(normalized_text) < 350:
        return False
    signal_count = sum(1 for signal in JD_DETAIL_SIGNALS if signal in normalized_text)
    if signal_count < 2:
        return False
    if any(marker in normalized_text for marker in GENERIC_SUMMARY_MARKERS):
        return False
    return True


# 2026-05-06 신규: 짧더라도 사용자가 직접 넣은 기술 중심 JD는 허용하기 위한 보조 기준
def _is_concise_manual_jd_usable(jd_text: str) -> bool:
    normalized_text = re.sub(r"\s+", " ", jd_text).strip()
    if len(normalized_text) < 25:
        return False
    if len(_extract_skills(normalized_text)) >= 2:
        return True
    return any(
        signal in normalized_text
        for signal in ["백엔드", "RESTful", "gRPC", "커넥티드", "트래픽", "마이크로서비스"]
    )


# 2026-05-06 신규: JD 원문에서 특정 섹션의 범위를 잘라 후속 agent가 쓸 근거를 보존
def _slice_jd_section(source_text: str, marker: str, limit: int = 1200) -> str | None:
    start = source_text.find(marker)
    if start < 0:
        return None

    end_candidates = [
        source_text.find(next_marker, start + len(marker))
        for next_marker in JD_SECTION_MARKERS
        if next_marker != marker and source_text.find(next_marker, start + len(marker)) > start
    ]
    end = min(end_candidates) if end_candidates else start + limit
    return source_text[start : min(end, start + limit)].strip()


# 2026-05-06 신규: LLM 요약에서 지원자격/우대사항이 빠지면 원문 섹션을 다시 붙여 JD 기준 정보를 보존
def _preserve_jd_sections(source_text: str, jd_text: str) -> str:
    if not source_text.strip():
        return jd_text

    preserved_text = jd_text.strip()
    for marker in ["직무상세", "지원자격", "우대사항"]:
        if marker in source_text and marker not in preserved_text:
            section_text = _slice_jd_section(source_text, marker)
            if section_text:
                preserved_text = f"{preserved_text}\n\n{section_text}".strip()

    return preserved_text[:3500]


# 2026-04-10 신규: JD 본문에서 핵심 기술명을 별도로 추출
def _extract_skills(jd_text: str) -> list[str]:
    lowered_text = jd_text.lower()
    return [
        skill for skill in PRIORITY_SKILLS if skill.lower() in lowered_text
    # 2026-05-06 수정: 우대사항 기술 키워드가 잘리지 않도록 최대 10개까지 보존
    ][:10]


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
            # 2026-05-06 신규: 공고 본문 품질 판단에 공통으로 쓰는 껍데기 페이지 문구
            shell_indicators = [
                "javascript를 활성화",
                "enable javascript",
                "this app works best with javascript",
            ]

            # 2026-05-06 신규: 정적 HTML 안에 실제 JD가 있으면 바로 사용
            if (
                text
                and not any(indicator in text.lower() for indicator in shell_indicators)
                and _is_substantive_jd_text(text)
            ):
                return text[:MAX_SOURCE_TEXT_LENGTH]

            # 2026-05-06 신규: CSR 공고는 Reader가 실제 렌더링 본문을 읽게 먼저 시도
            parsed_job_url = urlparse(job_url)
            reader_path = f"{parsed_job_url.netloc}{parsed_job_url.path}"
            if parsed_job_url.query:
                reader_path = f"{reader_path}?{parsed_job_url.query}"
            # 2026-05-06 수정: Jina Reader는 브라우저 User-Agent에서 403이 날 수 있어 별도 기본 client로 호출
            reader_response = httpx.get(
                f"https://r.jina.ai/http://{reader_path}",
                follow_redirects=True,
                timeout=OPENAI_TIMEOUT_SECONDS,
            )
            reader_response.raise_for_status()
            reader_text = reader_response.text.strip()
            if reader_text and not any(
                indicator in reader_text.lower() for indicator in shell_indicators
            ):
                return reader_text[:MAX_SOURCE_TEXT_LENGTH]

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

            # 2026-05-06 수정: 메뉴/푸터만 있는 껍데기 HTML은 성공으로 보지 않고 Reader fallback을 시도
            if (
                merged_text
                and not any(indicator in merged_text.lower() for indicator in shell_indicators)
                and _is_substantive_jd_text(merged_text)
            ):
                return merged_text[:MAX_SOURCE_TEXT_LENGTH]

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

    # 2026-05-06 수정: JD 요약에 면접 질문으로 이어질 구체 업무 키워드가 포함되도록 프롬프트 강화
    system_prompt = """
    너는 채용 공고 분석기다.
    입력된 채용 공고 텍스트를 읽고 아래 JSON만 반환해라.
    - companyName: 회사명
    - positionName: 직무명
    - jdText: 사용자에게 보여줄 수 있게 정리한 JD 본문 요약
    - extractedSkills: 기술명 배열
    - extractedKeywords: 핵심 키워드 배열
    - sourceType: JOB_POSTING_URL 또는 MANUAL
    - status: COMPLETED

    규칙:
    1. 직무명은 가장 구체적인 채용 포지션명으로 적는다.
    2. 회사명은 추정이 아니라 공고 본문에 근거해 적는다. 없으면 URL/수동 입력을 참고한다.
    3. jdText는 공고 핵심만 5~7문장, 700자 이내의 자연스러운 한국어로 요약한다.
    4. 개발자 직무 분류표에 끼워 맞추지 말고, 원문에 나온 직무상세/지원자격/우대사항을 기준으로 뽑는다.
    5. extractedSkills는 기술 스택, 프레임워크, 언어, 도구, 모델명만 넣고 추상어는 넣지 마라.
    6. extractedKeywords는 역할, 도메인, 업무 주제, 평가/프로세스 키워드를 넣는다.
    7. 우대사항에 적힌 기술도 중요한 분석 대상이므로 extractedSkills에 적극 반영한다.
    8. 사용자가 직접 입력한 JD가 더 구체적이면 그 내용을 우선 반영한다.
    9. 기술 직무가 아닌 공고도 억지로 개발자 포지션처럼 바꾸지 마라.
    10. 상단 메뉴, 추천공고, 사이드바, 다른 채용 공고 제목은 분석 대상에서 제외한다.
    11. "[채용전환형 인턴십] 인포테인먼트 개발"처럼 대괄호가 포함된 상세 공고 제목이 있으면 그 값을 positionName으로 우선 사용한다.
    12. jdText는 실제 공고 본문 섹션인 조직소개, 직무상세, 지원자격, 우대사항을 기준으로 요약한다.
    13. jdText에는 원문에 있는 구체 업무명, 도메인, 시스템, 자격요건을 반드시 포함한다.
    14. "성장 기회", "다양한 혜택", "혁신적인 솔루션" 같은 일반 문장만으로 jdText를 채우지 마라.
    15. 원문 근거가 부족하면 추측해서 채우지 말고 실패 가능한 짧은 JSON을 반환하되, 원문 전체를 붙여넣지 마라.
    16. extractedSkills는 우대사항과 직무상세에 나온 언어, 프로토콜, API 방식, 플랫폼, 통신 기술, 도구를 원문 표현 그대로 뽑는다.
    17. extractedKeywords는 직무상세/지원자격/우대사항에서 역할, 도메인, 시스템, 아키텍처, 트래픽/규모, 협업 대상, 검증/인증 업무를 뽑는다.
    18. 특히 한 단어 일반어보다 "서버 백엔드", "대규모 트래픽", "커넥티드 카", "무선 통신", "마이크로서비스"처럼 면접 질문으로 쓸 수 있는 구체 명사구를 우선한다.
    19. "제조", "인턴십", "채용전환형", "경력"처럼 채용 형태나 상단 메뉴에 가까운 단어는 핵심 키워드로 넣지 않는다.
    20. extractedSkills와 extractedKeywords는 네가 sourceText를 읽고 판단하되, sourceText에 없는 단어는 넣지 마라.
    21. jdText에는 extractedSkills/extractedKeywords 중 면접 질문으로 이어질 핵심 항목을 5개 이상 자연스럽게 포함한다.
    22. jdText는 단순 직무 소개가 아니라 "무엇을 개발/설계/검증/분석하는지"가 보이게 작성한다.
    23. 우대사항은 마지막 문장에 관련 전공, 언어/기술 경험, 통신/시스템 경험 중심으로 짧게 요약한다.
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
        # 2026-05-06 수정: 메뉴 링크가 아니라 본문 heading의 대괄호 직무명을 우선 사용
        primary_title = next(
            (
                re.sub(r"^#+\s*", "", line.strip())
                for line in source_text.splitlines()
                if (
                    re.match(r"^\[[^\]]+\]\s*.{2,60}$", re.sub(r"^#+\s*", "", line.strip()))
                    and "javascript:" not in line
                    and "](" not in line
                )
            ),
            None,
        )
        position_name = (
            primary_title
            or parsed.get("positionName")
            or payload.manualJobTitle
            or payload.manualPositionName
        )
        jd_text = parsed.get("jdText") or payload.manualJdText or source_text[:2000]
        # 2026-05-06 수정: 짧은 핵심 요약은 허용하고, 일반 문장/원문 덤프만 실패 처리
        normalized_jd_text = re.sub(r"\s+", " ", jd_text).strip()
        if (
            any(marker in source_text for marker in JD_SECTION_MARKERS)
            and (
                len(normalized_jd_text) < 120
                or len(normalized_jd_text) > 1000
                or any(marker in jd_text for marker in GENERIC_SUMMARY_MARKERS)
            )
        ):
            jd_text = ""
        else:
            jd_text = normalized_jd_text
        analysis_basis_text = (
            payload.manualJdText.strip()
            if payload.manualJdText and payload.manualJdText.strip()
            else "\n".join(part for part in [source_text, jd_text] if part)
        )
        extracted_skills = _normalize_llm_terms(
            terms=list(parsed.get("extractedSkills", [])),
            basis_text=analysis_basis_text,
            limit=10,
        )
        extracted_keywords = _normalize_llm_terms(
            terms=list(parsed.get("extractedKeywords", [])),
            basis_text=analysis_basis_text,
            limit=12,
        )
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

        merged_keywords: list[str] = []
        for keyword in extracted_keywords:
            if keyword not in merged_keywords:
                merged_keywords.append(keyword)
        merged_keywords = _sanitize_keywords(merged_keywords, analysis_basis_text)

        # 2026-05-06 신규: URL/LLM 분석이 실제 JD 근거 없이 만든 일반 요약이면 성공 저장하지 않음
        if (
            not company_name
            or not position_name
            or not jd_text
            or len(jd_text) < 120
            or len(jd_text) > 1000
            or not merged_keywords
        ):
            return None

        return JobAnalyzeResponse(
            companyName=company_name,
            positionName=position_name,
            jdText=jd_text,
            # 2026-05-06 수정: 개발자 카탈로그 fallback 대신 LLM이 원문에서 뽑은 기술만 저장
            extractedSkills=merged_skills[:10],
            extractedKeywords=merged_keywords[:12],
            keywords=merged_keywords[:12],
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
        # 2026-05-06 신규: URL 본문을 읽었는데 LLM 분석이 실패하면 규칙 기반 약한 요약을 저장하지 않음
        if fetched_text and not payload.manualJdText:
            return None

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
    # 2026-05-06 신규: URL 분석 fallback도 실제 JD 근거가 약하면 성공 응답을 만들지 않음
    if not _is_substantive_jd_text(jd_text) and not _is_concise_manual_jd_usable(jd_text):
        return None
    extracted_skills = _extract_skills(jd_text)
    extracted_keywords = _sanitize_keywords(_extract_keywords(jd_text), jd_text)

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

    # 2026-05-06 수정: URL 기반 분석에서 본문/수동 JD가 빈약하면 가짜 성공 응답 대신 명확한 실패를 반환
    if (
        _pick_job_url(payload)
        and not _is_substantive_jd_text(payload.manualJdText or "")
        and not _is_concise_manual_jd_usable(payload.manualJdText or "")
    ):
        raise HTTPException(
            status_code=422,
            detail="공고 URL에서 실제 직무상세/지원자격/우대사항을 추출하지 못했습니다. 해당 섹션이 포함된 JD 본문을 함께 입력해주세요.",
        )

    company_name = payload.manualCompanyName or "Unknown Company"
    position_name = (
        payload.manualJobTitle or payload.manualPositionName or "General Position"
    )
    jd_text = payload.manualJdText or (
        f"{company_name}의 {position_name} 관련 일반 공고입니다."
    )
    extracted_skills = _extract_skills(jd_text)
    extracted_keywords = _sanitize_keywords(_extract_keywords(jd_text), jd_text)

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

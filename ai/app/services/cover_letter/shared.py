import json
import re

import httpx

from app.core.config import settings
from app.schemas.cover_letter import (
    CoverLetterDocumentsInput,
    CoverLetterFeedbackRequest,
    CoverLetterQuestionScore,
)

KEYWORD_STOPWORDS = {
    "및",
    "경험",
    "우대",
    "기반",
    "관련",
    "수행",
    "개발",
    "업무",
    "역량",
    "프로젝트",
    "직무",
    "지원",
    "분야",
    "전문성",
    "노력",
    "문항",
    "내용",
    "기준",
}

ROLE_SIGNAL_KEYWORDS = [
    "유지보수",
    "운영",
    "오퍼레이터",
    "설비",
    "공정",
    "품질",
    "데이터",
    "분석",
    "자동화",
    "제어",
    "최적화",
    "생산",
    "문제 해결",
]

ACTION_SIGNAL_KEYWORDS = [
    "분석",
    "개선",
    "설계",
    "최적화",
    "구축",
    "제안",
    "검증",
    "튜닝",
    "적용",
    "도출",
    "해결",
]

OPENAI_TIMEOUT_SECONDS = 25.0


# 2026-04-21 신규: 직접 입력 텍스트와 파일 추출 텍스트 중 실제 사용할 값을 정규화
def pick_text(primary: str | None, file_text: str | None) -> str:
    return (primary or file_text or "").strip()


# 2026-04-21 신규: 자소서 평가용 문서 텍스트 묶음을 공통 형식으로 정리
def normalize_documents(documents: CoverLetterDocumentsInput) -> dict[str, str]:
    return {
        "coverLetterText": pick_text(
            documents.coverLetterText, documents.coverLetterFileText
        ),
        "resumeText": pick_text(documents.resumeText, documents.resumeFileText),
        "portfolioText": pick_text(
            documents.portfolioText, documents.portfolioFileText
        ),
    }


# 2026-04-21 신규: JD에서 핵심 토큰을 간단한 규칙으로 추출
def extract_keywords(jd_text: str, limit: int = 8) -> list[str]:
    keywords: list[str] = []
    for token in re.findall(r"[A-Za-z][A-Za-z0-9.+#-]{1,}|[가-힣]{2,}", jd_text):
        normalized = token.strip()
        if normalized.lower() in KEYWORD_STOPWORDS:
            continue
        if normalized not in keywords:
            keywords.append(normalized)
        if len(keywords) >= limit:
            break
    return keywords


# 2026-04-21 신규: 추출한 키워드가 문서에 얼마나 반영됐는지 계산
def count_keyword_hits(keywords: list[str], text: str) -> int:
    lowered_text = text.lower()
    return sum(1 for keyword in keywords if keyword.lower() in lowered_text)


# 2026-04-21 신규: 강점/약점/액션 개수를 항상 3개로 맞추기 위한 보조 함수
def fill_to_three(items: list[str], fallback_items: list[str]) -> list[str]:
    filled = list(items)
    for fallback in fallback_items:
        if len(filled) >= 3:
            break
        if fallback not in filled:
            filled.append(fallback)
    return filled[:3]


# 2026-04-21 신규: 화면 표시용 평문 정리
def sanitize_plain_text(text: str) -> str:
    cleaned = text.strip()
    cleaned = re.sub(r"^\s*#{1,6}\s*", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"\*\*(.*?)\*\*", r"\1", cleaned)
    cleaned = re.sub(r"__(.*?)__", r"\1", cleaned)
    cleaned = re.sub(r"`([^`]*)`", r"\1", cleaned)
    cleaned = re.sub(r"^\s*[-*]\s+", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"\((.*?)\)", r"\1", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


# 2026-04-21 신규: 자소서를 문항 단위로 분리
def split_cover_letter_questions(cover_letter_text: str) -> list[tuple[int, str, str]]:
    matches = list(
        re.finditer(r"(\[문항\s*(\d+)\][^\n]*)", cover_letter_text, re.MULTILINE)
    )
    if not matches:
        return [(1, "전체 자소서", cover_letter_text.strip())]

    question_blocks: list[tuple[int, str, str]] = []
    for index, match in enumerate(matches):
        question_number = int(match.group(2))
        title = match.group(1).strip()
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(
            cover_letter_text
        )
        body = cover_letter_text[start:end].strip()
        question_blocks.append((question_number, title, body))
    return question_blocks


# 2026-04-21 신규: JD와 직무명에서 직무 적합도 판단용 핵심 토큰을 추출
def extract_job_focus_keywords(position_name: str, jd_text: str) -> list[str]:
    merged_source = f"{position_name}\n{jd_text}"
    focus_keywords = extract_keywords(merged_source, limit=12)
    prioritized_keywords: list[str] = []

    for keyword in ROLE_SIGNAL_KEYWORDS:
        if keyword in merged_source and keyword not in prioritized_keywords:
            prioritized_keywords.append(keyword)

    for keyword in focus_keywords:
        if keyword not in prioritized_keywords:
            prioritized_keywords.append(keyword)
        if len(prioritized_keywords) >= 12:
            break
    return prioritized_keywords[:12]


# 2026-04-21 신규: 문항별 점수를 보수적으로 계산
def score_question(
    question_number: int,
    title: str,
    body: str,
    jd_keywords: list[str],
    job_focus_keywords: list[str],
) -> CoverLetterQuestionScore:
    body_text = body.strip()
    body_length = len(body_text)
    keyword_hits = count_keyword_hits(jd_keywords, body_text)
    focus_hits = count_keyword_hits(job_focus_keywords, body_text)
    has_metric = bool(re.search(r"\d", body_text))
    has_role_detail = any(
        signal in body_text for signal in ["역할", "담당", "제가", "저는"]
    )
    has_action = any(signal in body_text for signal in ACTION_SIGNAL_KEYWORDS)
    has_job_link = any(
        signal in body_text
        for signal in ["직무", "공정", "설비", "생산", "운영", "품질", "데이터", "최적화"]
    )

    score = 42
    score += min(keyword_hits, 4) * 5
    score += min(focus_hits, 3) * 4
    score += 7 if has_metric else 0
    score += 5 if has_role_detail else 0
    score += 5 if has_action else 0
    score += 5 if has_job_link else 0
    score += 4 if body_length >= 220 else 0
    score = max(38, min(score, 92))

    feedback_parts: list[str] = []
    if keyword_hits >= 2:
        feedback_parts.append("JD 키워드가 어느 정도 연결됩니다")
    else:
        feedback_parts.append("JD 키워드 연결이 약합니다")
    if has_metric:
        feedback_parts.append("성과 수치가 있어 설득력이 있습니다")
    else:
        feedback_parts.append("성과 수치를 더 보강하면 좋습니다")
    if has_role_detail:
        feedback_parts.append("본인 역할이 비교적 보입니다")
    else:
        feedback_parts.append("본인 역할을 더 분명히 써야 합니다")

    return CoverLetterQuestionScore(
        questionNumber=question_number,
        title=title,
        score=score,
        feedback=", ".join(feedback_parts),
    )


# 2026-04-21 신규: OpenAI JSON 응답을 공통으로 호출하는 helper
def request_openai_json(system_prompt: str, payload: dict) -> dict | None:
    if not settings.OPENAI_API_KEY:
        return None

    request_body = {
        "model": settings.OPENAI_JOB_ANALYSIS_MODEL,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
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
        return json.loads(data["choices"][0]["message"]["content"])
    except Exception:
        return None


# 2026-04-21 신규: 자소서 질문 입력을 OpenAI용 구조로 정리
def build_question_inputs(payload: CoverLetterFeedbackRequest) -> list[dict]:
    normalized_documents = normalize_documents(payload.documents)
    cover_letter_text = normalized_documents["coverLetterText"]
    return [
        {
            "questionNumber": question_number,
            "title": title,
            "body": body,
        }
        for question_number, title, body in split_cover_letter_questions(
            cover_letter_text
        )
        if body.strip()
    ]

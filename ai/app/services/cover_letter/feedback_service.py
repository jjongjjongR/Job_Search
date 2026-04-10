# ai/app/services/cover_letter/feedback_service.py
# 자소서 피드백 더미 응답을 반환하는 서비스 파일

import re

from app.schemas.cover_letter import (
    CoverLetterDocumentsInput,
    CoverLetterFeedbackRequest,
    CoverLetterFeedbackResponse,
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
}


# 2026-04-10 신규: 텍스트 입력과 파일 추출 텍스트 중 실제 사용할 값을 정규화
def _pick_text(primary: str | None, file_text: str | None) -> str:
    return (primary or file_text or "").strip()


# 2026-04-10 신규: 문서 텍스트 묶음을 피드백 생성용으로 정리
def _normalize_documents(documents: CoverLetterDocumentsInput) -> dict[str, str]:
    return {
        "coverLetterText": _pick_text(
            documents.coverLetterText, documents.coverLetterFileText
        ),
        "resumeText": _pick_text(documents.resumeText, documents.resumeFileText),
        "portfolioText": _pick_text(
            documents.portfolioText, documents.portfolioFileText
        ),
    }


# 2026-04-10 신규: JD 기준 키워드를 간단한 규칙으로 추출
def _extract_keywords(jd_text: str) -> list[str]:
    keywords: list[str] = []
    for token in re.findall(r"[A-Za-z][A-Za-z0-9.+#-]{1,}|[가-힣]{2,}", jd_text):
        normalized = token.strip()
        if normalized.lower() in KEYWORD_STOPWORDS:
            continue
        if normalized not in keywords:
            keywords.append(normalized)
        if len(keywords) >= 8:
            break
    return keywords


# 2026-04-10 신규: JD 키워드 반영 정도를 점수 계산에 사용
def _count_keyword_hits(keywords: list[str], text: str) -> int:
    lowered_text = text.lower()
    return sum(1 for keyword in keywords if keyword.lower() in lowered_text)


# 2026-04-10 신규: 부족한 항목을 기본 문장으로 채워 항상 3개를 유지
def _fill_to_three(items: list[str], fallback_items: list[str]) -> list[str]:
    filled = list(items)
    for fallback in fallback_items:
        if len(filled) >= 3:
            break
        if fallback not in filled:
            filled.append(fallback)
    return filled[:3]


# 2026-04-10 수정: JD와 문서 텍스트를 바탕으로 구조화된 자소서 피드백을 생성
def cover_letter_feedback_service(
    payload: CoverLetterFeedbackRequest,
) -> CoverLetterFeedbackResponse:
    normalized_documents = _normalize_documents(payload.documents)
    cover_letter_text = normalized_documents["coverLetterText"]
    resume_text = normalized_documents["resumeText"]
    portfolio_text = normalized_documents["portfolioText"]
    combined_text = " ".join(
        text for text in [cover_letter_text, resume_text, portfolio_text] if text
    )
    keywords = _extract_keywords(payload.jobAnalysis.jdText)
    keyword_hits = _count_keyword_hits(keywords, combined_text)
    cover_length = len(cover_letter_text)
    has_metric = bool(re.search(r"\d", combined_text))
    has_resume = bool(resume_text)
    has_portfolio = bool(portfolio_text)

    total_score = 55
    total_score += min(keyword_hits, 5) * 6
    total_score += 5 if has_resume else 0
    total_score += 4 if has_portfolio else 0
    total_score += 6 if cover_length >= 180 else 0
    total_score += 4 if has_metric else 0
    total_score = max(40, min(total_score, 100))

    strengths: list[str] = []
    weaknesses: list[str] = []
    revision_directions: list[str] = []

    if keyword_hits >= 3:
        strengths.append("JD 핵심 키워드가 자소서와 이력서에 비교적 잘 반영되어 있습니다.")
    else:
        weaknesses.append("JD 핵심 키워드 반영이 약해서 직무 적합성이 바로 드러나지 않습니다.")
        revision_directions.append("JD에 나온 기술과 역할 키워드를 문단별로 직접 연결해 보세요.")

    if has_metric:
        strengths.append("숫자나 성과 근거가 일부 보여서 설득력이 생깁니다.")
    else:
        weaknesses.append("성과를 보여주는 숫자나 결과 근거가 부족합니다.")
        revision_directions.append("프로젝트 결과를 수치나 개선 효과로 한 줄씩 보강해 보세요.")

    if cover_length >= 180:
        strengths.append("자소서 본문 길이가 너무 짧지 않아 경험 설명의 뼈대는 갖춰져 있습니다.")
    else:
        weaknesses.append("자소서 본문이 짧아서 경험 맥락과 본인 역할 설명이 부족합니다.")
        revision_directions.append("상황-역할-행동-결과 순서로 한 경험을 더 길게 풀어 쓰세요.")

    if has_resume:
        strengths.append("이력서 정보가 함께 들어와서 자소서와 경력 흐름을 같이 볼 수 있습니다.")
    else:
        weaknesses.append("이력서 정보가 없어 자소서의 근거 문장을 교차 확인하기 어렵습니다.")
        revision_directions.append("가능하면 이력서 핵심 경험도 함께 넣어 문장 근거를 맞춰 보세요.")

    if has_portfolio:
        strengths.append("포트폴리오 내용이 포함되어 프로젝트 연결 근거를 만들기 좋습니다.")
    else:
        weaknesses.append("포트폴리오 정보가 없어 프로젝트 상세 근거가 약하게 보일 수 있습니다.")
        revision_directions.append("대표 프로젝트 1~2개의 역할과 결과를 포트폴리오와 함께 정리해 보세요.")

    strengths = _fill_to_three(
        strengths,
        [
            "문장 흐름이 비교적 안정적이라 읽는 부담이 크지 않습니다.",
            "지원 직무와 완전히 어긋난 내용은 보이지 않습니다.",
            "경험을 정리할 수 있는 기본 재료는 확보되어 있습니다.",
        ],
    )
    weaknesses = _fill_to_three(
        weaknesses,
        [
            "본인 역할과 기술 선택 이유가 더 분명하면 좋습니다.",
            "문단마다 직무 연결 문장이 조금 더 필요합니다.",
            "경험 근거를 더 구체적으로 적으면 신뢰도가 올라갑니다.",
        ],
    )
    revision_directions = _fill_to_three(
        revision_directions,
        [
            "문단 마지막마다 지원 직무와 연결되는 한 문장을 추가해 보세요.",
            "프로젝트별 역할과 사용 기술을 분리해서 적어 보세요.",
            "강점 문장을 결과 중심 표현으로 다시 다듬어 보세요.",
        ],
    )

    summary = (
        f"{payload.jobAnalysis.companyName} {payload.jobAnalysis.positionName} 기준으로 보면 "
        f"JD 키워드 반영도는 {'좋은 편' if keyword_hits >= 3 else '보완 필요'}이며, "
        f"{'성과 근거가 일부 보여 강점이 있습니다' if has_metric else '성과 근거 보강이 필요합니다'}."
    )

    return CoverLetterFeedbackResponse(
        totalScore=total_score,
        summary=summary,
        strengths=strengths,
        weaknesses=weaknesses,
        revisionDirections=revision_directions,
        nextActions=revision_directions,
    )

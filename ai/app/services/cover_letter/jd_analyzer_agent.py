from app.schemas.cover_letter import CoverLetterFeedbackRequest
from app.services.cover_letter.shared import (
    extract_job_focus_keywords,
    extract_keywords,
)


# 2026-04-21 신규: AI/규칙이 뽑은 JD 키워드가 실제 JD 원문에 있는지 검증
def _verify_keyword_in_jd(keyword: str, jd_text: str) -> bool:
    return keyword.strip().lower() in jd_text.lower()


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

    return {
        "companyName": payload.jobAnalysis.companyName.strip(),
        "positionName": position_name,
        "jdText": jd_text,
        "jdKeywords": verified_jd_keywords,
        "jobFocusKeywords": verified_focus_keywords,
        "rejectedJdKeywords": [
            keyword for keyword in raw_keywords if keyword not in verified_jd_keywords
        ],
    }

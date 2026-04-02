# ai/app/services/jobs/analyze_service.py
# 공고 분석 더미 응답을 반환하는 서비스 파일

from app.schemas.jobs import JobAnalyzeRequest, JobAnalyzeResponse

# 2026.04.01 이종헌: 신규
def analyze_job_service(payload: JobAnalyzeRequest) -> JobAnalyzeResponse:
    return JobAnalyzeResponse(
        companyName="Dummy Company",
        positionName="Dummy Position",
        jdText="Dummy JD text",
        keywords=["python", "fastapi", "backend"],
        sourceType="MANUAL",
    )
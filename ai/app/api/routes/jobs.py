# ai/app/api/routes/jobs.py
# 공고 분석 관련 내부 API를 두는 라우트 파일

from fastapi import APIRouter, Depends

from app.api.deps import verify_internal_shared_secret
from app.schemas.jobs import JobAnalyzeRequest, JobAnalyzeResponse
from app.services.jobs.analyze_service import analyze_job_service

# 2026.04.01 이종헌: 수정(secret 적용)
router = APIRouter(
    prefix = '/internal/jobs', tags=["jobs"],
    dependencies = [Depends(verify_internal_shared_secret)],    
)

# 2026.04.01 이종헌: 수정(서비스 분리)
@router.post("/analyze", response_model = JobAnalyzeResponse)
def analyze_job(payload: JobAnalyzeRequest) -> JobAnalyzeResponse:
    return analyze_job_service(payload)
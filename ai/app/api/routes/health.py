# ai/app/api/routes/health.py
# 서버가 살아있는지 확인하는 health check API

from fastapi import APIRouter

router = APIRouter(tags=["health"])

@router.get("/health")
def health_check() -> dict[str, str]:
    return {"status":"ok"}
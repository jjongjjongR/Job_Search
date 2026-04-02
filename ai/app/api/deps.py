# ai/app/api/deps.py
# 내부 API 호출용 공통 의존성 함수를 두는 파일

from fastapi import Header, HTTPException, status

from app.core.config import settings


def verify_internal_shared_secret(
    x_internal_shared_secret: str | None = Header(default=None),
) -> None:
    if x_internal_shared_secret != settings.INTERNAL_SHARED_SECRET:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "errorCode": "INTERNAL_AUTH_INVALID",
                "message": "내부 API 인증에 실패했습니다.",
                "retryable": False,
                "details": None,
            },
        )
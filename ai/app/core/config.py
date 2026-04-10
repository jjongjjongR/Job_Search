# ai/app/core/config.py
# 환경변수와 설정값을 읽어오는 파일

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # NestJS와 FastAPI가 서로 맞춰서 사용할 내부 비밀값
    INTERNAL_SHARED_SECRET: str = "change-me"
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_DEFAULT_TTL_SECONDS: int = 600

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


settings = Settings()

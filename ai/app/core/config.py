# ai/app/core/config.py
# 환경변수와 설정값을 읽어오는 파일

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # NestJS와 FastAPI가 서로 맞춰서 사용할 내부 비밀값
    INTERNAL_SHARED_SECRET: str = "change-me"

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


settings = Settings()
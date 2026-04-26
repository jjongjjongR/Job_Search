# ai/app/core/config.py
# 환경변수와 설정값을 읽어오는 파일

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # NestJS와 FastAPI가 서로 맞춰서 사용할 내부 비밀값
    INTERNAL_SHARED_SECRET: str = "change-me"
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_DEFAULT_TTL_SECONDS: int = 600
    REDIS_CLEANUP_WORKER_ENABLED: bool = True
    REDIS_CLEANUP_INTERVAL_SECONDS: int = 30
    OPENAI_API_KEY: str | None = None
    OPENAI_JOB_ANALYSIS_MODEL: str = "gpt-4o-mini"
    OPENAI_STT_MODEL: str = "gpt-4o-mini-transcribe"
    COVER_LETTER_RAG_DB_PATH: str = "data/cover_letter_rag.sqlite3"
    BACKEND_STORAGE_ROOT: str = "../backend/storage"

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


settings = Settings()

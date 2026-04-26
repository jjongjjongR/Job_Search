# ai/app/main.py
# FastAPI 앱을 시작하고 전체 라우터를 연결하는 진입점

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from app.api.routes.health import router as health_router
from app.api.routes.jobs import router as jobs_router
from app.api.routes.cover_letter import router as cover_letter_router
from app.api.routes.interview import router as interview_router
from app.core.config import settings
from app.services.interview.cleanup_service import (
    run_cleanup_worker,
    stop_cleanup_worker,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    cleanup_stop_event = asyncio.Event()
    cleanup_task: asyncio.Task[None] | None = None

    if settings.REDIS_CLEANUP_WORKER_ENABLED:
        cleanup_task = asyncio.create_task(run_cleanup_worker(cleanup_stop_event))

    try:
        yield
    finally:
        if cleanup_task is not None:
            await stop_cleanup_worker(cleanup_task, cleanup_stop_event)

app = FastAPI(
    title = 'World_JobSearch AI Server',
    version = "0.1.0",
    lifespan=lifespan,
)

app.include_router(health_router)
app.include_router(jobs_router)
app.include_router(cover_letter_router)
app.include_router(interview_router)

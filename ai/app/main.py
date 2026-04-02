# ai/app/main.py
# FastAPI 앱을 시작하고 전체 라우터를 연결하는 진입점

from fastapi import FastAPI
from app.api.routes.health import router as health_router
from app.api.routes.jobs import router as jobs_router
from app.api.routes.cover_letter import router as cover_letter_router
from app.api.routes.interview import router as interview_router

app = FastAPI(
    title = 'World_JobSearch AI Server',
    version = "0.1.0",
)

app.include_router(health_router)
app.include_router(jobs_router)
app.include_router(cover_letter_router)
app.include_router(interview_router)
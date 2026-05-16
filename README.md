# World_Job_Search

온 세상이 취업은 로그인 기반 취업 준비 플랫폼이다. 게시판, 자료실, 사용자 문서 업로드, 공고 분석, 자기소개서 피드백, AI 면접 연습과 결과 재조회를 하나의 흐름으로 묶는다.

## 구조

- `frontend`: Next.js 사용자 화면
- `backend`: NestJS 공개 API, 인증/인가, DB 저장, FastAPI 내부 호출
- `ai`: FastAPI 내부 AI 서버
- `docs`: AI 계약, 저장 정책, 면접 규칙, 단계별 점검 문서
- `자료`: 원본 요구사항, API 명세, 아키텍처 자료

프론트엔드는 반드시 NestJS 공개 API만 호출한다. FastAPI는 외부에 직접 노출하지 않고, NestJS가 `x-internal-shared-secret` 헤더로 내부 호출한다.

## 고정 기준

현재 구현 기준은 `자료/단계별 진행가이드.txt`의 고도화 이전 범위다.

- 0~10단계: 계약 문서, FastAPI/NestJS/DB/Redis/storage, 공고 분석, 자소서 피드백, 면접 시작/질문/답변 평가
- 11~14단계: STT fallback, Vision 보조 평가, 세션 종료 리포트, cleanup 정책
- 15~18단계: 프론트 연결, 로컬 통합 테스트 문서, Docker 구성, AWS 이전 계획

고도화 단계의 질문 품질 개선, 리포트 자연어 튜닝, 성장 추적, B2B 통계 등은 후속 범위로 둔다.

## 로컬 실행

### 무과금 실행 원칙

아래 값은 비워 둔다. 값이 비어 있으면 AI 서버는 OpenAI 호출 대신 로컬 heuristic/RAG fallback으로 동작한다.

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_API_KEY`

참고 파일:

- `ai/.env.no-cost.example`
- `backend/.env.no-cost.example`
- `frontend/.env.no-cost.example`

각 서비스별 직접 실행:

```bash
cd ai
pip install -r requirements.txt
uvicorn app.main:app --reload
```

```bash
cd backend
pnpm install
pnpm run start:dev
```

```bash
cd frontend
pnpm install
pnpm dev
```

Docker Compose 실행:

```bash
docker compose up --build
```

현재 로컬 기준에서는 Docker CLI, Compose v2 플러그인, buildx 플러그인으로 `docker compose up --build -d` 실행을 확인했다. 이 작업은 로컬 도구 실행이며 AWS/GCP/OpenAI 비용을 발생시키지 않는다.

기본 포트:

- Frontend: `http://localhost:3000`
- Backend API/Swagger: `http://localhost:3001`, `http://localhost:3001/docs`
- AI internal API: `http://localhost:8000`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

## 검증

```bash
cd ai && pytest
cd backend && npm test -- --runInBand
cd frontend && npm run build
```

통합 시나리오는 `docs/local-integration-checklist.md`를 기준으로 확인한다.

2026-05-16 로컬 검증 결과:

- `frontend`: `pnpm run build` 통과, Docker 런타임에서 Next.js 15.5.18 `next start` 확인
- `docker compose up --build -d`: frontend/backend/ai/postgres/redis 기동 확인
- 로그인 후 `/users/me`, 공고 분석, 자소서 피드백 API 흐름 확인
- Vision: MediaPipe backend로 얼굴 미검출 샘플 영상 `INVALID` 판정 확인
- cleanup: temp answer video orphan 14개 실제 삭제 후 dry-run 결과 0개 확인

임시 저장소 orphan 파일 점검:

```bash
cd backend
npm run storage:cleanup-temp -- --dry-run
```

## 핵심 문서

- `docs/ai-contract.md`
- `docs/interview-rules.md`
- `docs/storage-policy.md`
- `docs/stage-0-10-completion-audit.md`
- `docs/interview-stage-8-12-audit.md`
- `docs/pre-advanced-completion-audit.md`
- `docs/local-integration-checklist.md`
- `docs/aws-migration-plan.md`
- `docs/deep-implementation-security-audit.md`

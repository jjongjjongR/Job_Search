# Backend

NestJS 공개 API 서버다. 인증/인가, 게시판, 자료실, 파일 다운로드, 공고 분석 저장, 자소서 리포트 저장, 면접 세션/턴 저장을 담당하고 FastAPI 내부 AI 서버를 호출한다.

## 역할

- Frontend가 호출하는 공개 API 제공
- JWT 인증과 권한 검사
- PostgreSQL 영구 저장
- private storage adapter 경유 파일 저장/다운로드
- FastAPI 내부 API 호출과 에러 매핑
- Swagger 문서 제공: `/docs`

## 주요 API

- `POST /auth/signup`
- `POST /auth/login`
- `POST /jobs/analyze`
- `POST /ai/cover-letter/feedback`
- `GET /ai/cover-letter/reports`
- `GET /ai/cover-letter/reports/:reportId`
- `POST /ai/interview/sessions/start`
- `POST /ai/interview/sessions/:sessionId/answers`
- `POST /ai/interview/sessions/:sessionId/finish`
- `GET /ai/interview/sessions`
- `GET /ai/interview/sessions/:sessionId`
- `GET /ai/interview/sessions/:sessionId/turns`

## 실행

```bash
pnpm install
pnpm run start:dev
```

기본 포트는 `3001`이다.

## 환경변수

- `PORT`
- `FRONTEND_URL`
- `DB_HOST`
- `DB_PORT`
- `DB_USERNAME`
- `DB_PASSWORD`
- `DB_NAME`
- `DB_SYNCHRONIZE`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `AI_INTERNAL_BASE_URL`
- `AI_INTERNAL_SHARED_SECRET`

## 테스트

```bash
npm test -- --runInBand
```

## Migration

```bash
pnpm run migration:run
pnpm run migration:show
```

운영/AWS 이전 시 `DB_SYNCHRONIZE=false`를 유지하고 migration으로만 스키마를 변경한다.

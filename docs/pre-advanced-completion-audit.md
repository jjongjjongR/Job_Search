# Pre-Advanced Completion Audit

## 1. 목표 재정의

사용자 요청은 `README.md`, `docs` 폴더, `자료` 폴더의 문서를 읽고, `자료/단계별 진행가이드.txt`의 고도화 이전 단계까지 꼼꼼하게 맞추는 것이다.

이 문서에서 고도화 이전 단계는 0~18단계로 본다. 단, 18단계 AWS 배포는 실제 클라우드 배포가 아니라 로컬 완성본을 AWS로 이전하기 위한 변경 지점 정리까지를 현재 저장소 산출물로 둔다.

## 2. 프롬프트-산출물 체크리스트

| 요구 | 근거 산출물 | 상태 |
| --- | --- | --- |
| README 확인 및 프로젝트 기준 반영 | `README.md`, `ai/README.md`, `backend/README.md`, `frontend/README.md` | 반영 |
| `docs` 파일 확인 | `docs/ai-contract.md`, `docs/interview-rules.md`, `docs/storage-policy.md`, 관련 audit 문서 | 반영 |
| `자료` 폴더 기준 확인 | `자료/단계별 진행가이드.txt`, `자료/project_v8.txt`, `자료/프로젝트_기준사항v9.txt` | 반영 |
| 고도화 이전 단계까지 진행 | 0~18단계별 산출물과 구현/문서/검증 항목 | 반영 |
| 고도화는 후속 범위로 분리 | 19단계 고도화 항목은 이 문서와 README에서 후속 범위로 명시 | 반영 |

## 3. 단계별 점검

### 0단계. 계약 문서

근거:

- `docs/ai-contract.md`
- `docs/interview-rules.md`
- `docs/storage-policy.md`

확인:

- 공개 API, 내부 API, 저장/삭제 정책, 면접 규칙, 에러 상태, 요청/응답 예시가 분리되어 있다.

### 1단계. FastAPI 뼈대

근거:

- `ai/app/main.py`
- `ai/app/api/routes/health.py`
- `ai/app/api/routes/jobs.py`
- `ai/app/api/routes/cover_letter.py`
- `ai/app/api/routes/interview.py`

확인:

- `/health`
- `/internal/jobs/analyze`
- `/internal/cover-letter/feedback`
- `/internal/interview/start`
- `/internal/interview/answer`
- `/internal/interview/finish`

### 2단계. NestJS 공개 API와 내부 호출

근거:

- `backend/src/jobs/jobs.controller.ts`
- `backend/src/cover-letter/cover-letter.controller.ts`
- `backend/src/interview/interview.controller.ts`
- `backend/src/ai-client/ai-client.service.ts`

확인:

- 프론트는 NestJS 공개 API만 호출하도록 `frontend/src/lib/api.ts`에서 API base를 NestJS로 둔다.
- FastAPI 내부 호출은 `AiClientService`에서 처리한다.

### 3단계. DB 엔티티와 migration

근거:

- `backend/src/database/migrations/1760100000000-AddAiPersistenceTables.ts`
- `backend/src/jobs/entities/job-analysis-request.entity.ts`
- `backend/src/cover-letter/entities/cover-letter-report.entity.ts`
- `backend/src/interview/entities/interview-session.entity.ts`
- `backend/src/interview/entities/interview-turn.entity.ts`

확인:

- `job_analysis_requests`
- `cover_letter_reports`
- `interview_sessions`
- `interview_turns`

### 4단계. Redis 임시 상태

근거:

- `ai/app/adapters/redis_state_store.py`
- `ai/app/services/interview/cleanup_service.py`
- `docs/redis-key-design.md`

확인:

- 세션 state, raw transcript, raw vision, hidden score, stt retry, cleanup key helper가 존재한다.
- cleanup worker가 due cleanup session을 삭제한다.

### 5단계. 파일 저장 추상화

근거:

- `backend/src/storage/ports/storage.port.ts`
- `backend/src/storage/adapters/local-storage.adapter.ts`
- `backend/src/storage/storage.module.ts`
- `docs/storage-architecture.md`

확인:

- durable/temp 목적이 분리되어 있고, S3 adapter로 교체 가능한 port 구조다.

### 6단계. 공고 분석

근거:

- `ai/app/services/jobs/analyze_service.py`
- `backend/src/jobs/jobs.service.ts`
- `backend/src/jobs/dto/analyze-job.dto.ts`

확인:

- URL/수동 입력 fallback, `jobPostingUrl` 별칭, DB 저장과 이후 재사용 흐름이 구현되어 있다.

### 7단계. 자소서 피드백

근거:

- `ai/app/services/cover_letter/cover_letter_graph.py`
- `ai/app/services/cover_letter/feedback_service.py`
- `backend/src/cover-letter/cover-letter.service.ts`
- `frontend/src/app/ai_cover_letter/page.tsx`

확인:

- JD 기준 평가, RAG/LangGraph 흐름, 리포트 저장/목록/상세/삭제가 구현되어 있다.

### 8~12단계. 면접 시작, 질문, 평가, STT, Vision

근거:

- `docs/interview-stage-8-12-audit.md`
- `ai/app/services/interview/start_service.py`
- `ai/app/services/interview/question_planner.py`
- `ai/app/services/interview/answer_evaluator.py`
- `ai/app/services/interview/stt_service.py`
- `ai/app/services/interview/vision_service.py`
- `ai/app/services/vision/mediapipe_backend.py`

확인:

- 첫 질문 1분 자기소개, 10문항 계획, 꼬리질문 제한, 답변 충분성 기준, STT 2회 fallback, Vision 보조 지표가 반영되어 있다.

### 13단계. 턴 저장 / 세션 종료 / 리포트

근거:

- `ai/app/services/interview/finish_service.py`
- `backend/src/interview/interview.service.ts`
- `backend/src/interview/entities/interview-turn.entity.ts`
- `backend/src/interview/entities/interview-session.entity.ts`

확인:

- 5문항 이상 리포트 생성, 최종 점수/등급/요약 저장, 턴별 질문/답변/피드백 저장 흐름이 존재한다.

### 14단계. 세션 종료/삭제 정책

근거:

- `ai/app/services/interview/cleanup_service.py`
- `ai/app/adapters/redis_state_store.py`
- `docs/storage-policy.md`
- `docs/redis-key-design.md`

확인:

- cleanup key와 worker가 존재하며 10분 삭제 정책을 구현할 수 있다.

### 15단계. 프론트 연결

근거:

- `frontend/src/app/ai_cover_letter/page.tsx`
- `frontend/src/app/ai_interview/page.tsx`
- `frontend/src/app/mypage/page.tsx`
- `frontend/src/lib/api.ts`

확인:

- 공고 분석, 자소서 피드백, 면접 세션 시작, 답변 제출, 텍스트 fallback, 최종 결과 표시, 리포트 조회 UI가 NestJS API에 연결되어 있다.

### 16단계. 로컬 통합 테스트

근거:

- `docs/local-integration-checklist.md`
- 자동 검증 명령:
  - `cd ai && pytest`
  - `cd backend && npm test -- --runInBand`
  - `cd frontend && npm run build`

확인:

- 통합 수동 시나리오와 샘플 데이터가 문서화되어 있다.

### 17단계. Docker 정리

근거:

- `docker-compose.yml`
- `ai/Dockerfile`
- `backend/Dockerfile`
- `frontend/Dockerfile`
- `.dockerignore`

확인:

- Frontend, Backend, AI, PostgreSQL, Redis를 compose로 실행할 수 있는 구성이 추가되어 있다.
- 2026-05-16 기준 `docker compose up --build -d`로 전체 컨테이너 빌드와 기동을 확인했다.
- Docker buildx 플러그인 설치 후 기존 buildx 누락 경고 없이 빌드가 진행되는 것을 확인했다.

### 18단계. AWS 이전 정리

근거:

- `docs/aws-migration-plan.md`

확인:

- RDS, ElastiCache, S3, ECS private/public service, Amplify, GitHub Actions, EventBridge cleanup 전환 계획이 정리되어 있다.

## 4. 검증 결과

실행한 검증:

```bash
cd ai && pytest
cd backend && npm test -- --runInBand
cd frontend && npm run build
```

결과:

- AI: 6 passed
- Backend: 4 passed
- Frontend: production build 성공
- Docker compose: 환경에 `docker` CLI가 없어 미실행

## 5. 남은 범위

아래는 `자료/단계별 진행가이드.txt`의 19단계 고도화에 해당하므로 현재 범위에서 제외한다.

- 질문 품질 개선
- 꼬리질문 정확도 개선
- 리포트 자연어 고도화
- JD 키워드 추출 정교화
- LangGraph 기반 면접 상태 오케스트레이션 확장
- 사용자 성장 추적
- 리포트 비교
- 관리자 통계
- 실시간 면접 모드
- Vision 점수 보정
- B2B 버전

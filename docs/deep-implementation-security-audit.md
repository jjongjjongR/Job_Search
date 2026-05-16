# Deep Implementation And Security Audit

## 1. 목표

이 문서는 `자료/단계별 진행가이드.txt`, `자료/project_v8.txt`, `자료/프로젝트_기준사항v9.txt`, `docs/*` 기준으로 현재 구현을 세부 점검한 결과다.

점검 범위:

- 비용이 발생하지 않는 로컬 실행 설정
- 0~18단계 구현/문서 산출물
- 자소서 Agent, 면접 Agent, RAG, chunk 값, prompt, guardrail
- 보안 설계
- 면접 AI 저장공간과 cleanup 정책
- AI 신뢰성 구성

## 2. 비용 방지 점검

확인한 사실:

- `docker-compose.yml`에서 `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`를 빈 값으로 고정했다.
- `ai/.env.no-cost.example`, `backend/.env.no-cost.example`, `frontend/.env.no-cost.example`를 추가했다.
- AI 코드의 OpenAI 호출부는 `settings.OPENAI_API_KEY`가 없으면 호출하지 않고 fallback으로 빠진다.
- Docker compose는 PostgreSQL, Redis, Backend, AI, Frontend만 로컬 컨테이너로 구성한다.
- AWS, RDS, ElastiCache, S3, ECS, Amplify를 실제 생성하는 코드는 없다.

실행 증거:

```bash
docker --version
```

결과:

- Docker CLI: `Docker version 29.4.3`

```bash
docker compose config
```

결과:

- 2026-05-16 기준 Docker Compose v2 플러그인과 buildx 플러그인 설치 후 사용 가능

```bash
docker compose up --build -d
```

결과:

- Frontend, Backend, AI, PostgreSQL, Redis 컨테이너 빌드 및 기동 성공
- AI, Backend, PostgreSQL, Redis health check 통과
- Frontend Docker 로그에서 Next.js 15.5.18 `next start` 확인

대체 정적 검증:

```bash
python - <<'PY'
import yaml
with open('docker-compose.yml') as f:
    data = yaml.safe_load(f)
services = data['services']
assert services['ai']['environment']['OPENAI_API_KEY'] == ''
assert services['backend']['environment']['OPENAI_API_KEY'] == ''
assert services['ai']['environment']['STORAGE_PROVIDER'] == 'local'
assert services['backend']['environment']['STORAGE_PROVIDER'] == 'local'
assert set(services) == {'postgres', 'redis', 'ai', 'backend', 'frontend'}
print('docker-compose no-cost static check passed')
PY
```

결과:

- `docker-compose no-cost static check passed`

## 3. 단계별 구현 점검

| 단계 | 자료 기준 | 구현 증거 | 판단 |
| --- | --- | --- | --- |
| 0 | API/저장/면접 계약 문서 | `docs/ai-contract.md`, `docs/interview-rules.md`, `docs/storage-policy.md` | 충족 |
| 1 | FastAPI 뼈대 | `ai/app/main.py`, `ai/app/api/routes/*` | 충족 |
| 2 | NestJS 공개 API와 FastAPI 내부 호출 | `backend/src/ai-client/ai-client.service.ts`, jobs/cover-letter/interview controller | 충족 |
| 3 | AI 영구 저장 테이블 | `backend/src/database/migrations/1760100000000-AddAiPersistenceTables.ts` | 충족 |
| 4 | Redis temp state | `ai/app/adapters/redis_state_store.py`, `docs/redis-key-design.md` | 충족 |
| 5 | 파일 저장 추상화 | `backend/src/storage/ports/storage.port.ts`, `backend/src/storage/adapters/local-storage.adapter.ts` | 보강 후 충족 |
| 6 | 공고 분석 | `ai/app/services/jobs/analyze_service.py`, `backend/src/jobs/jobs.service.ts` | 충족 |
| 7 | 자소서 피드백 | `ai/app/services/cover_letter/*`, `backend/src/cover-letter/*` | 충족 |
| 8 | 면접 세션 시작 | `ai/app/services/interview/start_service.py` | 충족 |
| 9 | 질문 생성 | `ai/app/services/interview/question_planner.py` | 충족 |
| 10 | 답변 평가 | `ai/app/services/interview/answer_evaluator.py` | 충족 |
| 11 | STT fallback | `ai/app/services/interview/stt_service.py` | 충족 |
| 12 | Vision 보조 평가 | `ai/app/services/interview/vision_service.py`, `ai/app/services/vision/mediapipe_backend.py` | 충족 |
| 13 | 턴 저장/종료 리포트 | `backend/src/interview/interview.service.ts`, `ai/app/services/interview/finish_service.py` | 충족 |
| 14 | cleanup 정책 | `ai/app/services/interview/cleanup_service.py`, temp cleanup script | 보강 후 충족 |
| 15 | 프론트 연결 | `frontend/src/app/ai_cover_letter/page.tsx`, `frontend/src/app/ai_interview/page.tsx` | 충족 |
| 16 | 로컬 통합 테스트 | `docs/local-integration-checklist.md` | 충족 |
| 17 | Docker 정리 | `docker-compose.yml`, `*/Dockerfile` | 로컬 compose 빌드/기동 검증 완료 |
| 18 | AWS 이전 정리 | `docs/aws-migration-plan.md` | 문서 산출물 충족 |

## 4. 자소서 Agent 점검

Agent 흐름:

```text
jd_analyzer
-> rag_retriever
-> evidence_extractor
-> cover_letter_evaluator
-> draft_generator
-> draft_reviewer
```

구현 증거:

- `ai/app/services/cover_letter/cover_letter_graph.py`
- LangGraph 사용 가능 시 `StateGraph` 실행
- LangGraph 미설치/실패 시 fallback runner가 동일 순서 실행

### 4-1. `jd_analyzer`

파일:

- `ai/app/services/cover_letter/jd_analyzer_agent.py`

역할:

- 회사명, 직무명, JD 본문, JD 키워드, job focus keyword 추출
- OpenAI가 없어도 로컬 키워드 추출로 동작

판단:

- 자료 기준의 JD 우선 평가 원칙에 맞음

### 4-2. `rag_retriever`

파일:

- `ai/app/services/cover_letter/rag_retriever_agent.py`
- `ai/app/services/cover_letter/vector_rag_store.py`

chunk 값:

- `CHUNK_MAX_CHARS = 420`
- `CHUNK_OVERLAP_CHARS = 100`
- `VECTOR_DIMENSION = 256`
- query당 `limit=4`
- 최종 retrieved evidence 최대 10개

검색 query:

- JD keyword 상위 8개
- job focus keyword 상위 8개
- 고정 query template 6개

판단:

- 문항 단위 분리, 긴 문단 분리, overlap 유지가 구현되어 있다.
- 외부 embedding API를 쓰지 않고 해시 기반 로컬 embedding을 사용하므로 무과금 조건에 맞다.
- Chroma telemetry는 `anonymized_telemetry=False`로 꺼져 있다.

### 4-3. `evidence_extractor`

파일:

- `ai/app/services/cover_letter/evidence_extractor_agent.py`

역할:

- 문서 정규화
- keyword hit, 문항 입력, RAG context를 평가 agent 입력으로 묶음

판단:

- 평가 agent가 입력 문서/RAG 근거를 분리해서 볼 수 있다.

### 4-4. `cover_letter_evaluator`

파일:

- `ai/app/services/cover_letter/cover_letter_evaluator_agent.py`

prompt 핵심 guardrail:

- 정답 문장 암기식 평가 금지
- 입력 JD와 문서에 실제 있는 근거만 사용
- `retrievedEvidence` 우선 사용
- evidenceText는 가능한 retrievedEvidence 문장 사용
- 서버가 evidence를 원문 대조하고 검증 실패 시 감점

점수 구조:

- JD 반영도 25
- 직무 적합도 25
- 경험 구체성 20
- 성과/근거 15
- 문항 적합성 10
- 문장 완성도 5

판단:

- LLM 결과를 그대로 믿지 않고 `_verify_evidence`로 원문 대조한다.
- OpenAI key가 없으면 `HEURISTIC` source로 fallback한다.

### 4-5. `draft_generator`

파일:

- `ai/app/services/cover_letter/draft_generator_agent.py`

prompt 핵심 guardrail:

- 입력 근거에 없는 새 경험 생성 금지
- 원본 문항 수 유지
- `[문항 n] [소제목]` 형식 강제
- 마크다운 문법 금지

판단:

- 자료 기준상 최종 제출본 생성이 아니라 개선 예시로 제한된다.

### 4-6. `draft_reviewer`

파일:

- `ai/app/services/cover_letter/draft_reviewer_agent.py`

prompt 핵심 guardrail:

- JD 연결성
- 입력 근거 외 과장 금지
- 문항 수/형식 검증
- score 68 이상 + approved true만 통과

판단:

- 생성물 재검토 agent가 있어 신뢰성 구조가 보강되어 있다.

## 5. 면접 Agent 점검

Agent/서비스 흐름:

```text
session_start
-> question_planner
-> answer_stt
-> answer_evaluator
-> vision_analyzer
-> followup_resolver
-> next_question_resolver
-> report_generator
-> cleanup_scheduler
```

### 5-1. `session_start`

파일:

- `ai/app/services/interview/start_service.py`

확인:

- `SUFFICIENT`: JD + 사용자 문서 1개 이상
- `JD_ONLY`: JD만 있음
- `INSUFFICIENT`: 시작 차단
- 첫 질문 `1분 자기소개 부탁드립니다.`
- Redis session state 저장
- 면접 RAG collection 생성

판단:

- 자료 기준과 일치한다.

### 5-2. `question_planner`

파일:

- `ai/app/services/interview/question_planner.py`

질문 타입:

```text
SELF_INTRO
MOTIVATION
JD_FIT
JD_FIT
PROJECT_DEEP_DIVE
PROJECT_DEEP_DIVE
OTHER_PROJECT
OTHER_PROJECT
COLLAB_PROBLEM_SOLVING
CLOSING
```

prompt guardrail:

- 총 10문항
- 첫 질문 고정
- 타입 순서 고정
- 추상 질문 금지
- 사용자 문서 없는 프로젝트 질문은 JD 기반 학습/경험 질문으로 약화
- 120자 이내
- 질문 guardrail agent로 2차 검증

판단:

- LLM planner + LLM guardrail + 서버 normalize + fallback planner 구조다.
- OpenAI key가 없으면 규칙 기반 planner로 동작한다.

### 5-3. `answer_stt`

파일:

- `ai/app/services/interview/stt_service.py`

확인:

- 3초 이하
- 음성 없음
- 심한 잡음
- 전사 결과 1문장 이하 + 핵심 명사 부족
- 같은 턴 최대 2회
- 2회 실패 후 `REQUEST_TEXT`
- text fallback은 accepted 처리

판단:

- 자료 기준과 일치한다.
- OpenAI key가 없으면 실제 STT 호출 없이 `transcriptHint`/`answerText` 기반 fallback으로 동작한다.

### 5-4. `answer_evaluator`

파일:

- `ai/app/services/interview/answer_evaluator.py`

prompt guardrail:

- 점수는 반드시 `answerText`에 실제로 말한 내용 기준
- `retrievedEvidence`는 맥락 검증용
- 답변에 없는 역할/성과/기술/프로젝트는 RAG에 있어도 점수 근거로 사용 금지
- 충분성 기준 고정

점수:

- 질문 적합성 20
- 구체성 20
- 근거/성과 15
- 직무 적합성 15
- 논리성/구조 10
- 진정성/태도 5
- 합계 85

판단:

- RAG가 점수를 부풀리지 않도록 prompt와 fallback test를 추가했다.

### 5-5. `vision_analyzer`

파일:

- `ai/app/services/interview/vision_service.py`
- `ai/app/services/vision/mediapipe_backend.py`

확인:

- 텍스트 답변은 `SKIPPED`, 0점
- 다중 얼굴은 `INVALID`, 0점
- 얼굴 유지율 0.55 미만은 `INVALID`, 0점
- 저조도/가림은 `WEAKENED`, 3~4점
- 정상은 `VALID`, 6~8점
- 감정 분석 없음

판단:

- Vision은 15점 전체 중 일부 보조 점수로만 작동한다.
- 실패해도 면접 흐름은 계속된다.

### 5-6. `followup_resolver` / `next_question_resolver`

파일:

- `ai/app/services/interview/answer_evaluator.py`
- `ai/app/services/interview/next_question_resolver.py`

확인:

- 꼬리질문 최대 2회
- 우선순위: 역할/기여도, 성과/근거, 직무 연결, 전문성 디테일, 협업/태도
- LLM follow-up은 직전 질문/답변/JD를 입력으로 받음
- 서버 검증에서 고정 문장/무관 질문 차단

판단:

- 자료 기준과 일치한다.

### 5-7. `report_generator`

파일:

- `ai/app/services/interview/finish_service.py`

확인:

- 5문항 미만은 `CANCELLED`, 리포트 미생성
- 5문항 이상은 평균 점수 기반 최종 리포트
- 질문-답변, 턴별 피드백 포함
- LLM report generator는 서버 계산 총점/등급을 변경하지 못함

판단:

- 신뢰성 기준에 맞게 서버 계산값을 기준으로 둔다.

### 5-8. `cleanup_scheduler`

파일:

- `ai/app/services/interview/cleanup_service.py`
- `ai/app/adapters/redis_state_store.py`
- `backend/scripts/cleanup-temp-storage.js`

확인:

- Redis cleanup key에 deadline 저장
- raw transcript/raw vision/hidden score/stt retry/session state 삭제
- temp video storage key 삭제
- interview RAG collection 삭제
- Redis state가 없어 남은 orphan temp 파일은 backend script로 dry-run/삭제 가능

실행 증거:

```bash
cd backend
npm run storage:cleanup-temp -- --dry-run
```

결과:

- `storage/temp/interview_answer_upload` 아래 14개 orphan temp 파일 후보를 확인했다.
- 실제 삭제는 수행하지 않았다.

## 6. 보안 점검

확인된 보안 설계:

- FastAPI 내부 API는 `x-internal-shared-secret` 검증
- NestJS 공개 API는 JWT guard 적용
- 파일 다운로드는 서버 경유 방식
- 자료실 업로드는 MASTER 권한 필요
- AI 내부 오류는 NestJS에서 400/401/404/5xx 의미별 매핑
- Local storage path traversal 방어를 보강했다.

이번 보강:

- `backend/src/storage/adapters/local-storage.adapter.ts`
  - `../` 또는 absolute path escape 차단
- `backend/src/storage/adapters/local-storage.adapter.spec.ts`
  - path traversal resolve/delete 테스트 추가
- `backend/src/test/test.controller.ts`
  - `OPENAI_API_KEY`를 반환하는 미등록 테스트 컨트롤러 삭제

남은 운영 주의점:

- 운영에서는 `JWT_SECRET`, `AI_INTERNAL_SHARED_SECRET`을 강한 값으로 교체해야 한다.
- 운영에서는 `DB_SYNCHRONIZE=false`를 유지해야 한다.
- Swagger 운영 공개 범위는 배포 단계에서 제한하는 것이 좋다.
- 프론트 access token은 현재 localStorage 기반이므로 운영 보안 수준을 높이려면 httpOnly cookie 전환을 검토할 수 있다.

## 7. 저장공간 점검

영구 저장:

- `job_analysis_requests`
- `cover_letter_reports`
- `interview_sessions`
- `interview_turns`
- `question_text`
- `answer_video_title`
- `answer_full_text`
- `feedback_text`
- `nonverbal_summary_text`
- 최종 리포트 요약 필드

임시 저장:

- Redis session state
- raw transcript
- raw vision metrics
- hidden score
- stt retry
- cleanup deadline
- `temp/interview_answer_upload`

장기 저장 금지:

- raw video
- raw frame image
- raw transcript 원본
- raw vision 원본
- hidden score

판단:

- 정상 흐름에서는 Redis cleanup worker가 임시 데이터를 삭제한다.
- Redis state 유실/개발 중단 등으로 남은 temp 파일을 위해 `storage:cleanup-temp` 보조 스크립트를 추가했다.

## 8. AI 신뢰성 점검

신뢰성 장치:

- LLM 호출 전부 API key 없으면 fallback
- LLM output은 JSON 형태 요구
- 서버 normalize/검증 후 사용
- 자소서 evidence 원문 대조
- RAG evidence는 평가 근거 보조이며 답변 내용을 대체하지 않음
- 질문 planner 결과는 guardrail agent와 서버 normalize를 통과해야 함
- follow-up은 답변/JD token 교집합 검증
- 최종 리포트 LLM은 서버 총점/등급 변경 불가
- Vision 실패 시 흐름 계속

추가 테스트:

- `ai/tests/test_rag_and_prompt_contracts.py`
  - chunk 상수와 boundary
  - prompt guardrail 문구
  - no-cost heuristic RAG path
  - RAG evidence가 약한 답변 점수를 부풀리지 않는지 검증

## 9. 검증 결과

실행:

```bash
cd ai && pytest
cd backend && npm test -- --runInBand
cd frontend && npm run build
```

결과:

- AI: 10 passed
- Backend: 6 passed
- Frontend: production build 성공

추가:

- `docker-compose.yml` no-cost static check 통과
- `storage:cleanup-temp -- --dry-run`으로 orphan temp 후보 확인

## 10. 결론

현재 저장소는 자료 기준의 고도화 이전 범위를 대부분 구현했고, 이번 점검에서 비용 방지 설정, path traversal 방어, orphan temp cleanup 보조 장치, RAG/prompt 계약 테스트, 비밀값 노출 위험 파일 제거를 보강했다.

남은 것은 Docker Compose 플러그인을 설치한 뒤 실제 `docker compose config`와 `docker compose up --build`를 실행해 컨테이너 기동까지 확인하는 것이다. 이 작업은 로컬 Docker 실행이며 클라우드 비용은 발생하지 않는다.

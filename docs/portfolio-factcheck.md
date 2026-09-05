# World Job Search / 온세상이취업 — 포트폴리오 팩트체크

> 판단 기준: 실제 소스코드, 설정 파일, `package.json`, `requirements.txt`, `docker-compose*.yml`, `nginx/world-jobsearch.conf`, `docs/`
> 상태 표기: **IMPLEMENTED**(코드로 구현 증명) / **PARTIAL**(일부) / **DOC_ONLY**(문서·설계만) / **UNKNOWN**(소스만으로 판단 불가)

---

## 1. 전체 프로젝트 구조 — IMPLEMENTED

`frontend`(Next.js), `backend`(NestJS), `ai`(FastAPI), `docs`, `nginx`, `docker-compose.yml`, `docker-compose.prod.yml` 모두 실제 존재.

| 서비스 | 실제 역할(코드 기준) | 근거 |
| --- | --- | --- |
| frontend | App Router 화면. login/board/dataroom/ai_cover_letter/ai_interview/mypage | `frontend/src/app/*` |
| backend | 공개 REST API·인증·DB·파일·AI 호출. 컨트롤러 10개 | `backend/src/*/*.controller.ts` |
| ai | 내부 AI 서버. 공고분석/자소서/면접 pipeline | `ai/app/api/routes/*`, `ai/app/services/*` |
| nginx | reverse proxy (80 → 3000/3001) | `nginx/world-jobsearch.conf` |

---

## 2. 실제 기술 스택 — IMPLEMENTED

| 영역 | 실제 값 | 근거 |
| --- | --- | --- |
| Frontend | **Next 15.5.18, React 19.1.2**, next-auth, axios, react-hook-form, zod, lucide-react, tailwind | `frontend/package.json` |
| Backend | **NestJS 11.1.21**, TypeORM, @nestjs/jwt, passport-jwt, bcrypt, nodemailer, @nestjs/swagger, multer, pg, openai | `backend/package.json` |
| AI | fastapi 0.135, pydantic 2.12, **redis 6.4**, **langgraph>=0.2**, **chromadb 0.5**, **mediapipe 0.10.18**, opencv, httpx | `ai/requirements.txt` |
| DB/Cache | **PostgreSQL 16**, **Redis 7** | `docker-compose.prod.yml` |

라이브러리 실사용 여부:

| 항목 | 상태 | 근거 |
| --- | --- | --- |
| PostgreSQL / TypeORM | IMPLEMENTED | Entity 10개, `@nestjs/typeorm` |
| Redis | IMPLEMENTED | `ai/app/adapters/redis_state_store.py` |
| ChromaDB | IMPLEMENTED | `vector_rag_store.py` `chromadb.PersistentClient`, `get_or_create_collection` |
| OpenAI | IMPLEMENTED(선택적) | `shared.py:request_openai_json`, 키 없으면 `return None` |
| MediaPipe / OpenCV | PARTIAL | `vision_service.py`에서 metrics 사용, 상세 추론 경로는 확장 구조 |
| LangGraph | IMPLEMENTED(+fallback) | `cover_letter_graph.py:run_cover_letter_langgraph` (try import, 실패 시 fallback graph) |

> ⚠️ **RAG 임베딩 주의**: ChromaDB는 실제 사용하지만 임베딩은 신경망 모델이 아니라 **해시 기반 bag-of-words 벡터**(`embed_text` = `_hash_token % VECTOR_DIMENSION`) + cosine similarity. "벡터 검색"은 맞지만 "OpenAI/의미 임베딩"이라고 쓰면 과장.

---

## 3. 배포 구조

| 항목 | 상태 | 근거 |
| --- | --- | --- |
| EC2 + Docker Compose + Nginx reverse proxy | IMPLEMENTED | `docker-compose.prod.yml`(postgres/redis/ai/backend/frontend), `nginx/world-jobsearch.conf`, `.github/workflows/deploy-ec2.yml` |
| 내부 서비스 격리 | IMPLEMENTED | backend/frontend만 `127.0.0.1:3001/3000` 바인딩, ai/pg/redis는 Docker 네트워크 내부 |
| Nginx 경로 분기 | IMPLEMENTED | `location /`→3000, `location /backend/`→3001 |
| **HTTPS / SSL / 도메인 / certbot** | **DOC_ONLY** | nginx는 `listen 80`만. SSL 지시어 없음. `docs/aws-migration-plan.md`에 계획으로만 존재 |
| **ECS / Fargate / RDS / S3 / ElastiCache / Secrets Manager / ACM / Route53** | **DOC_ONLY** | 실제 설정 파일 없음. `docs/aws-migration-plan.md`, `docs/aws-ec2-minimal-deploy.md` 문서에만 등장 |

→ "**EC2 단일 서버 Docker Compose + Nginx(80) 배포**"는 사실. "HTTPS 적용", "AWS 관리형 서비스(RDS/S3 등) 사용"은 **쓰면 안 됨**(미구현).

---

## 4. 인증 / 보안 — 대부분 IMPLEMENTED

| 항목 | 상태 | 근거 |
| --- | --- | --- |
| 회원가입 / 로그인 | IMPLEMENTED | `auth.service.ts:signup/login` |
| JWT 발급/검증 | IMPLEMENTED | `jwtService.signAsync`, `strategies/jwt.strategy.ts:validate` |
| 비밀번호 bcrypt hash | IMPLEMENTED | `bcrypt.hash(password, 10)` (rounds 10) |
| 이메일 인증 | IMPLEMENTED | `mail.service.ts`, Gmail SMTP(nodemailer) |
| 인증 토큰 hash 저장 | IMPLEMENTED | `randomBytes(32)` 발급 → `createHash('sha256')` 저장, 만료 30분 |
| 미인증 로그인 차단 | IMPLEMENTED | login 시 `isEmailVerified` 검사 → `ForbiddenException` |
| JwtAuthGuard 보호 API | IMPLEMENTED | `common/guards/jwt-auth.guard.ts`, 8개 컨트롤러 `@UseGuards` |
| FastAPI 내부 shared secret | IMPLEMENTED | `ai/app/api/deps.py:verify_internal_shared_secret` → 불일치 시 401 / backend `ai-client.service.ts`가 `x-internal-shared-secret` 헤더 전송 |
| 파일 확장자·크기 검증 | IMPLEMENTED | 면접 업로드 `fileSize: 120*1024*1024`, 확장자 allowlist(`.mp4/.mov/.webm/.m4a/.mp3/.wav`); files `ALLOWED_EXTENSIONS`(.pdf/.docx/.hwp 등) |
| safe path 검증 | IMPLEMENTED | `local-storage.adapter.ts:resolveSafePath` → `..` 차단, spec 테스트 존재 |

소유권 검증:

| 영역 | 상태 | 근거 |
| --- | --- | --- |
| 게시글 수정/삭제 | IMPLEMENTED | `post.controller.ts` `assertOwnerOrMaster(currentUser, post.author, ...)` (단, author=displayName 비교) |
| 자소서 리포트 조회/삭제 | IMPLEMENTED | `cover-letter.service.ts` `where: { userId, id }`, `deleteReport(userId, reportId)` |
| 면접 세션 조회 | IMPLEMENTED | `interview.service.ts:590` `session.userId !== userId` 차단 |
| 자료실 등록/삭제 | IMPLEMENTED (권한형) | `dataroom.controller.ts` `assertMaster` → **MASTER 계정만** 가능 |

---

## 5. 핵심 기능 구현 범위

| 기능 | 상태 | 근거 |
| --- | --- | --- |
| 회원가입 | IMPLEMENTED | `auth.service.ts:signup` |
| 이메일 인증 | IMPLEMENTED | `auth.service.ts:verifyEmail`, `mail.service.ts` |
| 로그인 | IMPLEMENTED | `auth.service.ts:login` |
| JWT 보호 API | IMPLEMENTED | `jwt-auth.guard.ts` |
| 게시판 CRUD | IMPLEMENTED | `post.controller.ts` (create/find/update/remove) |
| 게시글 좋아요 | IMPLEMENTED | `post.service.ts:likePost`, `post-like.entity.ts` |
| 댓글 | IMPLEMENTED | `post/comment/comment.controller.ts` (`@Controller('comments')`) |
| 자료실 업로드/다운로드 | IMPLEMENTED | `dataroom.controller.ts` + `files` (다운로드는 files 경유) |
| MASTER/admin 자료실 관리 | IMPLEMENTED | `assertMaster` (등록·삭제 MASTER 전용) |
| 파일 업로드/다운로드 | IMPLEMENTED | `files.controller.ts`, `files.service.ts:resolveStoredFile` |
| 사용자 문서 업로드/조회/삭제 | PARTIAL | 자소서용 파일 업로드+텍스트 추출은 구현(`document-text-extractor.ts`, execFile 기반). 독립적 "문서함 CRUD"는 없음 |
| 공고 URL / JD 텍스트 분석 | IMPLEMENTED | `analyze_service.py:_fetch_job_posting_text`(httpx로 URL 페이지 fetch) + JD 텍스트, DTO `@IsUrl`/`@IsString` |
| 공고 분석 결과 저장·재사용 | IMPLEMENTED | `job_analysis_requests` 저장 → 자소서/면접에서 참조(`JobAnalysisRequest` 관계) |
| AI 자소서 피드백 생성 | IMPLEMENTED | `cover_letter/*` 8단계 파이프라인 |
| 자소서 리포트 저장/목록/상세/삭제 | IMPLEMENTED | `cover-letter.service.ts:listReports/getReport/deleteReport` |
| AI 면접 세션 시작 | IMPLEMENTED | `interview/start_service.py` |
| 면접 질문 생성 | IMPLEMENTED | `question_planner.py` |
| 영상 답변 업로드 | IMPLEMENTED | `interview.controller.ts` multer + `/sessions/uploads` |
| STT 전사 | IMPLEMENTED(선택적) | `stt_service.py` OpenAI STT, 키 없으면 fallback 판정 |
| 텍스트 답변 전환 | IMPLEMENTED | `stt_service.py:118` `next_retry_count >= 2` |
| Vision 비언어 보조 분석 | PARTIAL | `vision_service.py` 얼굴유지율/다중얼굴/저조도 규칙 존재, 감정분석 미사용 |
| 꼬리질문 생성 | IMPLEMENTED | `next_question_resolver.py` `follow_up_count < 2` |
| 면접 최종 리포트 | IMPLEMENTED | `finish_service.py` (5턴 조건) |
| 면접 세션/턴 재조회 | IMPLEMENTED | `interview.controller.ts` GET sessions/:id/turns |
| 마이페이지 활동 조회 | IMPLEMENTED | `frontend/src/app/mypage/page.tsx`, `posts/me/*`, reports 목록 |

---

## 6. AI 자소서 Agent Pipeline — 전부 IMPLEMENTED (LLM + fallback)

파일 경로: `ai/app/services/cover_letter/`. 모든 단계가 **OpenAI 키 있으면 LLM, 없으면 heuristic/규칙 fallback**.

| 단계 | 파일 | 핵심 함수 | LLM | 키 없을 때 fallback |
| --- | --- | --- | --- | --- |
| JD Analyzer | `jd_analyzer_agent.py` | `run_jd_analyzer_agent` | O | `_fallback_requirements`, `"HEURISTIC"` |
| RAG Retriever | `rag_retriever_agent.py` | `run_rag_retriever_agent` | X(검색) | ChromaDB + 해시 임베딩 검색 |
| Evidence Extractor | `evidence_extractor_agent.py` | `run_evidence_extractor_agent` | X | 문서·근거 정리 |
| Evaluator | `cover_letter_evaluator_agent.py` | `run..._evaluator`, `_build_rubric_scores`, `_verify_evidence` | O | `_build_fallback_rubric_scores`, `_fallback_requirement_evaluations` |
| Evaluation Validator | `evaluation_validator_agent.py` | `run..._validator`, `_heuristic_validation`, `_score_consistency_reasons` | O | `_heuristic_validation` |
| Draft Generator | `draft_generator_agent.py` | `run_draft_generator_agent` | O | fallback 제목/초안 생성 |
| Draft Reviewer | `draft_reviewer_agent.py` | `run_draft_reviewer_agent` | O | 내부 규칙 승인 |
| Orchestrator | `cover_letter_graph.py` | `run_cover_letter_langgraph`(StateGraph) / `_run_fallback_graph` | — | LangGraph 미설치 시 fallback runner |

입출력 공통: 입력 = jobAnalysis / documents / questionInputs / retrievedEvidence, 출력 = totalScore·jdAlignmentScore·jobFitScore·rubricScores·questionScores·strengths/weaknesses·revisionDirections·revisedDraft. 재평가 라우터(`_evaluation_retry_router_node`)로 validator 실패 시 재시도.

---

## 7. AI 면접 Pipeline — 규칙 대부분 IMPLEMENTED

| 항목 | 상태 | 근거 |
| --- | --- | --- |
| 문서 충분도 판단 | IMPLEMENTED | `DocumentSufficiency`(`schemas/common.py`), question_planner에서 사용 |
| 첫 질문 1분 자기소개 고정 | IMPLEMENTED | `question_planner.py:155,168,310` `"1분 자기소개 부탁드립니다."` 고정 |
| 질문 타입 구성 | IMPLEMENTED | `QUESTION_PLAN_TYPES` = SELF_INTRO/MOTIVATION/JD_FIT×2/PROJECT_DEEP_DIVE×2/OTHER_PROJECT×2/COLLAB/CLOSING |
| 꼬리질문 최대 2회 | IMPLEMENTED | `next_question_resolver.py:27` `follow_up_count < 2` |
| 답변 충분성 판단 | IMPLEMENTED | `answer_evaluator.py`, evaluation `is_sufficient` |
| STT 실패 시 같은 턴 재업로드 | IMPLEMENTED | `stt_service.py:evaluate_stt_fallback`, `retryCount` 관리 |
| 2회 실패 → 텍스트 전환 | IMPLEMENTED | `stt_service.py:118` `next_retry_count >= 2` |
| 텍스트 답변 시 비언어 0점 | IMPLEMENTED | `answer_service.py:58` `nonverbalScore=0` |
| 5턴 이상만 최종 리포트 | IMPLEMENTED | `finish_service.py:34,83` `len(hidden_scores) >= 5 / < 5` |
| 5턴 미만 종료 시 미생성 | IMPLEMENTED | `finish_service.py:83~99` 취소 상태 마감 |
| Vision 감정 분석 미사용 | IMPLEMENTED | `vision_service.py`에 emotion/감정 로직 없음 |
| 다중얼굴/저조도/가림/얼굴유지율 | IMPLEMENTED | `vision_service.py` `multiFaceDetected`, `faceDetectedRatio < 0.55`, 저조도/가림 분기 |
| hidden score / raw transcript / raw vision metrics | IMPLEMENTED | `redis_state_store.py:save_hidden_score/save_raw_transcript`, `rawVisionMetricsKey` |

---

## 8. 저장 정책

| 항목 | 상태 | 근거 |
| --- | --- | --- |
| PostgreSQL 영구 저장 | IMPLEMENTED | Entity 10개(users/post/dataroom/file/job_analysis_requests/cover_letter_reports/interview_sessions/interview_turns 등) |
| Redis 임시 저장 | IMPLEMENTED | `redis_state_store.py` 세션상태/hidden score/raw transcript/raw vision metrics/cleanup deadline |
| Redis TTL 설정 | IMPLEMENTED | `default_ttl_seconds`, `refresh_session_ttl`, `client.expire` |
| cleanup deadline 10분 | IMPLEMENTED | `schedule_cleanup(ttl_seconds=600)`, `answer_service.py deleteAfterSeconds=600` |
| cleanup worker/scheduler | IMPLEMENTED | `cleanup_service.py:run_cleanup_worker`(async 루프), `main.py:lifespan`에서 `asyncio.create_task` 등록 |
| temp storage cleanup(backend) | IMPLEMENTED | `backend/scripts/cleanup-temp-storage.js`, `npm run storage:cleanup-temp` |
| raw video/frame 장기 미저장 | PARTIAL | temp 키 + `deleteAfterSeconds=600` + cleanup worker 구조는 존재. 단 실제 물리 파일 삭제 완결성은 운영 환경 의존 |

→ **"10분 내 삭제"는 "구현 완료(cleanup worker + TTL 600s 동작)"로 써도 됨.** 다만 "모든 원본/중간값이 예외 없이 10분 내 삭제됨을 검증"까지 단언하지는 말 것(장애·환경 변수 존재).

---

## 9. 데이터베이스 / ERD — IMPLEMENTED (문서와 일치)

TypeORM Entity 10개. 명시 테이블명: `users`, `job_analysis_requests`, `cover_letter_reports`, `interview_sessions`, `interview_turns`. (post/comment/post_like/file/dataroom은 기본 네이밍)

핵심 관계(코드 확인):
- `job_analysis_requests` **1—N** `cover_letter_reports` (`@OneToMany`/`@ManyToOne`, `job_analysis_request_id`)
- `interview_sessions` **1—N** `interview_turns` (`session_id`)
- `users` **1—N** job_analysis_requests / cover_letter_reports / interview_sessions
- `post` **1—N** comment, post_like
- `dataroom` **1—1** file_entity (`file_id`, cascade)

→ 발표자료/README의 ERD 설명과 실제 Entity **일치**.

---

## 10. API 명세 — IMPLEMENTED

- NestJS 공개 컨트롤러: auth, users, posts, comments, dataroom, files, jobs, ai/cover-letter, ai/interview/sessions
- FastAPI 내부: `/health`, `/internal/jobs/analyze`, `/internal/cover-letter/feedback`, `/internal/interview/{start,answer,finish}`
- Swagger: IMPLEMENTED — `main.ts:SwaggerModule.setup('docs', ...)` → `/docs`
- README API 표와 실제 route **일치**.

포트폴리오 대표 API 추천(12개): `POST /auth/signup`, `POST /auth/login`, `GET /auth/verify-email`, `POST /jobs/analyze`, `POST /ai/cover-letter/feedback`, `GET /ai/cover-letter/reports/:id`, `POST /ai/interview/sessions/start`, `POST /ai/interview/sessions/uploads`, `POST /ai/interview/sessions/:id/answers`, `POST /ai/interview/sessions/:id/finish`, `POST /posts/:id/like`, `POST /internal/cover-letter/feedback`(내부 보호 API).

---

## 11. Guardrail / 검증 — IMPLEMENTED

| 검증 | 파일 · 함수 |
| --- | --- |
| DTO validation | `class-validator` DTO (`@IsUrl`, `@IsString` 등), `ValidationPipe` |
| Pydantic schema | `ai/app/schemas/*` 응답 모델(`response_model=...`) |
| LLM JSON 응답 검증 | `shared.py:request_openai_json` (JSON 파싱 실패 시 `except → None`) |
| evidence 근거 검증 | `cover_letter_evaluator_agent.py:_verify_evidence` (입력문서/JD 존재 확인) |
| rubric/점수 일관성 | `evaluation_validator_agent.py:_score_consistency_reasons`, 상단·항목 점수 차 검사 |
| draft hallucination 검토 | `draft_reviewer_agent.py:run_draft_reviewer_agent` |
| 면접 답변 근거 검증 | `interview/evaluation_validator.py` "answerText에 없는 역할·성과 근거 금지" |
| fallback 처리 | 모든 agent + `cover_letter_graph._run_fallback_graph` |
| timeout | `ai-client.service.ts` `AI_INTERNAL_REQUEST_TIMEOUT_MS`, `AI_INTERVIEW_ANSWER_TIMEOUT_MS` |
| 환경변수 검증 | `config/env.validation.ts:requireValue/requireProductionSafeValue` |

---

## 12. 테스트 / 검증 자료 — PARTIAL

| 자료 | 상태 | 근거 |
| --- | --- | --- |
| 백엔드 unit test | IMPLEMENTED | `env.validation.spec.ts`, `local-storage.adapter.spec.ts`, `ai-client.service.spec.ts` |
| 백엔드 e2e | PARTIAL | `backend/test/app.e2e-spec.ts`(기본 스캐폴드 수준) |
| AI test | IMPLEMENTED | `test_redis_cleanup_worker.py`, `test_rag_and_prompt_contracts.py`, `test_stage_0_10_rules.py` |
| Swagger | IMPLEMENTED | `/docs` |
| 통합 시나리오 문서 | IMPLEMENTED | `docs/local-integration-checklist.md` |
| Postman collection | 없음 | 파일 미발견 |

→ "**단위 테스트(pytest/jest) 일부 작성 + Swagger + 통합 체크리스트 기반 검증**"으로 쓰는 것이 정확. "전 기능 e2e/자동화 테스트 완비"는 과장.

---

## 13. 트러블슈팅 후보 (코드 근거 있음)

1. **FastAPI 내부 API 외부 노출 방지** — 문제: AI 서버가 뚫리면 LLM/비용 남용. 원인: 내부 API 무인증. 해결: `x-internal-shared-secret` 헤더 + `verify_internal_shared_secret`(401). 검증: `ai-client.service.spec.ts`. 배운 점: 서비스 간 신뢰경계. 근거: `deps.py`, `ai-client.service.ts:91`.
2. **LLM 키 없이도 동작(무과금 fallback)** — 원인: 비용/키 부재. 해결: `request_openai_json`이 키 없으면 None → heuristic 경로. 근거: `shared.py:271`, `test_rag_and_prompt_contracts.py`.
3. **STT 실패/재업로드 처리** — 해결: 재시도 카운트 2회 후 텍스트 전환, 텍스트는 비언어 0점. 근거: `stt_service.py:118`, `answer_service.py:58`.
4. **Redis TTL vs PostgreSQL 영구 저장 분리 + 리포트 복구** — 원인: Redis hidden score 만료. 해결: DB 저장 턴 5개 이상이면 리포트 복구. 근거: `finish_service.py`, `redis_state_store.py`.
5. **파일 업로드 path traversal 방지** — 해결: `resolveSafePath`가 `..` 차단. 검증: `local-storage.adapter.spec.ts`. 근거: `local-storage.adapter.ts:82`.
6. **이메일 인증 토큰 보안** — 원인: 토큰 원문 저장 위험. 해결: sha256 hash 저장 + 30분 만료. 근거: `auth.service.ts:190`.
7. **평가 점수 일관성(Guardrail)** — 해결: rubric 합계로 totalScore 재계산, validator가 상단·항목 점수 모순 검사. 근거: `evaluation_validator_agent.py`.

---

## 14. 발표자료 주장 검증

| 주장 | 판정 | 코멘트 |
| --- | --- | --- |
| LLM Agent 기반 취업 준비 통합 서비스 | ✅ 사실 | 8단계 자소서 + 면접 pipeline 실재 |
| 공고 분석 결과를 자소서·면접 기준 데이터로 재사용 | ✅ 사실 | `JobAnalysisRequest` 관계로 참조 |
| RAG 근거 검색 | ⚠️ 조건부 | ChromaDB 검색은 사실이나 **해시 임베딩**. "의미기반/신경망 임베딩"은 과장 |
| 단계별 Agent Pipeline | ✅ 사실 | 파일 단위 8+8 단계 |
| Guardrail로 점수 일관성·근거 확보 | ✅ 사실 | validator/evidence 검증 코드 존재 |
| FastAPI 내부 서버 분리 | ✅ 사실 | 별도 서비스 + shared secret |
| JWT·이메일 인증·내부 API 보호 | ✅ 사실 | 코드 확인 |
| PostgreSQL 영구 + Redis 임시 | ✅ 사실 | 코드 확인 |
| ChromaDB 문서 벡터 검색 | ✅ 사실(단서) | PersistentClient 사용, 임베딩 방식 명시 권장 |
| EC2 Docker Compose Nginx 배포 | ✅ 사실 | 단 HTTPS는 미적용(80만) |
| 민감 원본/중간값 장기 저장 방지 | ✅ 사실(구조) | TTL 600s + cleanup worker. "완벽 보장"까지는 과장 |

---

## 15. 개인 기여도

**소스만으로 개인 기여도는 단정 불가.** git 커밋 작성자가 여러 계정으로 분산되어 있고, 사용자 계정 이메일(whdgjs1012@gmail.com)과 정확히 일치하는 커밋 author가 없음.

| author | 커밋 수 |
| --- | --- |
| jjongjjongR `<sx0123@naver.com>` | 29 |
| jongheonlee `<jjongm3pro@...>` | 9 |
| 이종헌 `<jongheon@...>` | 2 |

(총 40 커밋) → 동일인이 여러 기기/계정을 썼는지, 팀 협업인지 **소스만으로 확정 불가**. 포트폴리오에 "단독 전 구현"이라고 쓰기 전에 실제 담당 범위를 본인이 확정해야 함.

포트폴리오 역할 구분 초안(근거 기반, 본인 확인 후 사용):
- 직접 구현: 인증/게시판/자료실/파일 API
- AI 설계·구현: 자소서·면접 Agent pipeline, RAG, Guardrail
- 인프라/배포: Docker Compose, Nginx, GitHub Actions EC2 배포
- 검증/문서화: 단위 테스트 일부, docs 감사 문서

---

# A. 포트폴리오에 "구현 완료"로 써도 되는 사실

| 항목 | 요약 | 근거 파일 | 신뢰도 |
| --- | --- | --- | --- |
| 3-tier 분리 아키텍처 | Next.js/NestJS/FastAPI + 내부 API 격리 | 각 서비스 디렉토리, `deps.py` | 높음 |
| JWT + 이메일 인증(토큰 hash) | bcrypt(10), sha256 토큰, 30분 만료 | `auth.service.ts` | 높음 |
| 내부 API shared-secret 보호 | 헤더 불일치 401 | `deps.py`, `ai-client.service.ts` | 높음 |
| 8단계 자소서 Agent + fallback | LLM/heuristic 이중 경로 | `cover_letter/*` | 높음 |
| 면접 규칙 엔진 | 1분 자기소개 고정·꼬리질문 2회·5턴·STT 2회·텍스트 0점 | `question_planner.py`, `stt_service.py`, `finish_service.py` | 높음 |
| Redis TTL + cleanup worker(10분) | worker가 lifespan에 등록 | `cleanup_service.py`, `main.py` | 높음 |
| 공고 URL fetch + JD 분석 저장·재사용 | httpx fetch, DB 관계 | `analyze_service.py` | 높음 |
| path traversal 방지 | `..` 차단 + spec | `local-storage.adapter.ts(.spec)` | 높음 |
| EC2 Docker Compose + Nginx(80) 배포 | 5개 서비스, 내부 격리 | `docker-compose.prod.yml`, nginx, deploy 워크플로우 | 높음 |
| Swagger 문서화 | `/docs` | `main.ts` | 높음 |

# B. 설계/개선 방향으로만 써야 하는 내용

| 항목 | 이유 | 문서 근거 | 코드 부족한 부분 |
| --- | --- | --- | --- |
| HTTPS/SSL/도메인 | nginx 80만, SSL 지시어 없음 | `aws-migration-plan.md` | certbot/443 미설정 |
| AWS 관리형 서비스(RDS/S3/ECS/ElastiCache/ACM/Route53) | 실제 설정 없음 | `aws-migration-plan.md` | IaC/설정 파일 부재 |
| 의미기반 RAG 임베딩 | 해시 임베딩 사용 | — | 신경망 임베딩 미사용 |
| 전 기능 자동화 테스트 | 일부 unit/AI test만 | — | 광범위 e2e 부재 |
| Vision 정밀 비언어 분석 | 규칙/지표 수준 | `interview-rules.md` | 정밀 모델 추론 경로 제한 |

# C. 과장 위험 표현 → 안전한 대체

| 위험 표현 | 왜 위험 | 안전한 표현 |
| --- | --- | --- |
| "OpenAI 임베딩 기반 RAG" | 해시 임베딩임 | "ChromaDB에 문서 chunk를 저장하고 유사도 검색으로 근거를 제공하는 RAG 구조" |
| "AWS 클라우드 네이티브(RDS/S3/ECS)" | 미구현 | "AWS EC2 단일 서버에 Docker Compose로 배포" |
| "HTTPS 보안 배포" | 80만 | "Nginx reverse proxy 기반 배포(HTTPS는 개선 과제)" |
| "완벽한 데이터 자동 삭제 보장" | 환경 의존 | "Redis TTL(10분)과 cleanup worker로 임시 데이터 자동 삭제 설계·구현" |
| "테스트 코드로 전 기능 검증" | 일부만 | "핵심 로직 단위 테스트 + Swagger/통합 체크리스트 기반 검증" |
| "단독 전체 개발" | git 확정 불가 | 실제 담당 범위를 명시(본인 확인 후) |

# D. 포트폴리오 핵심 어필 포인트 5

1. **LLM을 그대로 안 믿는 Guardrail 설계** — evidence 검증·rubric 재계산·validator 재시도. 근거: `evaluation_validator_agent.py`, `_verify_evidence`.
2. **8단계 Agent Pipeline + LangGraph/무과금 fallback 이중화** — 키·라이브러리 없어도 전 흐름 동작. 근거: `cover_letter_graph.py`, `shared.py:271`.
3. **실패 대응 중심 면접 엔진** — STT 2회 재시도→텍스트 전환, 텍스트 비언어 0점, 5턴 미만 리포트 미생성. 근거: `stt_service.py`, `answer_service.py`, `finish_service.py`.
4. **민감 데이터 수명주기 관리** — Redis TTL + 10분 cleanup worker + DB 영구 저장 분리 + 만료 시 리포트 복구. 근거: `redis_state_store.py`, `cleanup_service.py`, `finish_service.py`.
5. **서비스 간 신뢰경계 + 보안 기본기** — 내부 API shared-secret, JWT, 토큰 hash, path traversal 차단. 근거: `deps.py`, `auth.service.ts`, `local-storage.adapter.ts`.

# E. 사람에게 확인해야 할 질문 (소스만으로 불가)

1. git 커밋이 여러 계정(`sx0123@naver.com` 29 / `jjongm3pro` 9 / `이종헌` 2)으로 분산 — 전부 본인인가, 팀 협업인가? 개인 담당 범위는?
2. 실제 운영 배포에서 HTTPS를 적용한 적이 있는가(임시 tunnel 포함)? 있다면 포트폴리오에 "임시 HTTPS 검증" 수준으로만 기재 가능.
3. OpenAI 유료 키로 실제 LLM/STT를 돌려본 적이 있는가, 아니면 fallback 위주로 시연했는가?
4. Vision 비언어 분석을 실제 카메라 영상으로 검증한 결과가 있는가?
5. MASTER 계정 자료실 정책이 의도된 사양인가(일반 사용자는 업로드 불가)?

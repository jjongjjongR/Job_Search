# 0~10단계 완료 점검

이 문서는 `자료/단계별 진행가이드.txt`, `자료/project_v8.txt`, `자료/프로젝트_기준사항v9.txt`, `docs/ai-contract.md`, `docs/interview-rules.md`, `docs/storage-policy.md`를 기준으로 0~10단계 구현 상태를 다시 맞춘 결과를 정리한다.

## 범위

- 0단계: 고정 문서와 계약 정합성
- 1단계: FastAPI 뼈대
- 2단계: NestJS 공개 API 게이트웨이
- 3단계: DB 엔티티/마이그레이션
- 4단계: Redis temp state helper
- 5단계: 파일 저장 추상화
- 6단계: 공고 분석 AI
- 7단계: 자소서 피드백 AI
- 8단계: 면접 세션 시작
- 9단계: 질문 생성 엔진
- 10단계: 답변 평가 엔진

## 이번 보강 사항

- `자료` 기준 공개/내부 API 계약과 현재 코드 차이를 다시 점검했다.
- 공고 분석 공개 API가 `jobUrl` 뿐 아니라 `jobPostingUrl` 별칭도 함께 받도록 보강했다.
- 자소서 피드백 공개 API가 `coverLetterDocumentId`, `resumeDocumentId`, `portfolioDocumentId` 기반 문서 재사용 흐름을 지원하도록 보강했다.
- NestJS `AiClientService`가 FastAPI의 4xx/5xx를 전부 500으로 뭉개지 않고, 400/404/401/5xx를 구분해 전달하도록 수정했다.
- 자소서/공고 분석/면접 공개 API 흐름은 로컬 통합 점검으로 실제 동작을 다시 확인했다.

## 단계별 판단

### 0단계

- `docs/ai-contract.md`
- `docs/interview-rules.md`
- `docs/storage-policy.md`

위 문서가 존재하고, 이번 보강으로 공개 API 예시를 현재 코드가 받는 필드명과 다시 맞췄다.

### 1단계

- FastAPI 앱 진입점 존재
- `/health`
- `/internal/jobs/analyze`
- `/internal/cover-letter/feedback`
- `/internal/interview/start`
- `/internal/interview/answer`
- `/internal/interview/finish`

라우트와 schema/service 분리가 유지된다.

### 2단계

- 프론트는 NestJS 공개 API만 호출
- NestJS는 JWT 검증과 DTO 검증을 담당
- FastAPI는 `x-internal-shared-secret`을 검사
- 내부 API 실패는 NestJS가 사용자 의미에 맞는 4xx/5xx로 다시 매핑

### 3단계

- `job_analysis_requests`
- `cover_letter_reports`
- `interview_sessions`
- `interview_turns`

엔티티와 마이그레이션이 코드 기준으로 유지된다.

### 4단계

- `interview:session:{sessionId}:state`
- `interview:session:{sessionId}:transcript:{turnId}`
- `interview:session:{sessionId}:vision:{turnId}`
- `interview:session:{sessionId}:hidden-score:{turnId}`
- `interview:session:{sessionId}:stt-retry:{turnId}`
- `interview:session:{sessionId}:cleanup`

Redis helper, TTL 갱신, cleanup deadline 저장 구조가 구현되어 있다.

### 5단계

- `StoragePort`
- `LocalStorageAdapter`
- durable/temp 목적 구분
- protected storage key 기반 resolve

파일 저장 추상화는 현재 코드 기준으로 유지된다.

### 6단계

- 공고 분석 공개/내부 API 연결
- URL/수동 입력 fallback
- 분석 결과 DB 저장/재조회
- 이후 자소서/면접 재사용

이번 보강으로 `jobPostingUrl` 별칭도 공개 계약에서 허용한다.

### 7단계

- JD 재사용
- 자소서/이력서/포트폴리오 입력
- 문서 ID 재사용 흐름
- RAG + LangGraph 기반 자소서 평가
- 리포트 저장/조회/삭제

### 8단계

- 문서 충분도 계산
- `INSUFFICIENT` 차단
- 첫 질문 `1분 자기소개`
- DB 세션 row 생성
- Redis state 초기화

### 9단계

- 10문항 고정 흐름
- `JD_ONLY` 약화 질문 반영
- 중복 질문 최소화
- 질문 타입 고정

### 10단계

- 내용 점수 breakdown
- sufficient 판정
- 부족 사유 산출
- follow-up focus 산출
- OpenAI structured output + heuristic fallback

## 검증 메모

- 자소서 공개 통합 경로는 `signup -> login -> /jobs/analyze -> /ai/cover-letter/feedback -> report 조회`까지 실제 성공했다.
- 내부 AI 서버 로그에서도 `/internal/jobs/analyze`, `/internal/cover-letter/feedback`가 모두 `200 OK`로 확인됐다.

## 남은 고도화

0~10단계 완료 판단과 별개로 아래는 후속 고도화 대상으로 남는다.

- 면접 11단계 이후 실제 운영 튜닝
- 더 넓은 자동화 테스트 커버리지
- Vision/STT 품질 고도화

## 4단계 보강 메모

- `ai/app/services/interview/cleanup_service.py`
  - cleanup deadline 기준으로 만료된 세션 key를 실제 삭제하는 worker를 추가했다.
- `ai/app/main.py`
  - FastAPI lifespan에서 cleanup worker를 자동으로 시작/종료하도록 연결했다.
- `ai/app/adapters/redis_state_store.py`
  - due cleanup session 탐색과 삭제 실행 helper를 추가했다.
- `ai/tests/test_redis_cleanup_worker.py`
  - cleanup 대상 판별과 실제 삭제 위임 동작을 테스트로 고정했다.

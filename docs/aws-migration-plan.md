# AWS Migration Plan

## 1. 목적

이 문서는 `자료/단계별 진행가이드.txt` 18단계 기준으로 로컬 완성본을 AWS로 옮길 때 필요한 변경 지점을 정리한다. 실제 AWS 배포 실행은 고도화 이전 산출물의 범위를 넘어서는 운영 작업이므로, 이 문서에서는 코드 수정 지점, 인프라 변경 지점, 환경변수, 위험 요소를 고정한다.

## 2. DB: local PostgreSQL -> RDS

코드 수정 지점:

- `backend/src/config/configuration.ts`
- `backend/src/config/env.validation.ts`
- `backend/src/database/data-source.ts`
- TypeORM migration 실행 절차

인프라 변경 지점:

- RDS PostgreSQL 생성
- private subnet 배치
- ECS backend task security group에서만 5432 접근 허용
- 자동 백업과 스냅샷 정책 설정

환경변수:

- `DB_HOST`
- `DB_PORT`
- `DB_USERNAME`
- `DB_PASSWORD`
- `DB_NAME`
- `DB_SYNCHRONIZE=false`

위험 요소:

- 운영에서는 `synchronize=true` 금지
- migration 순서 불일치
- RDS security group 과다 개방
- timezone/connection pool 설정 누락

## 3. Redis: local Redis -> ElastiCache

코드 수정 지점:

- `ai/app/core/config.py`
- `ai/app/adapters/redis_state_store.py`

인프라 변경 지점:

- ElastiCache Redis 생성
- private subnet 배치
- ECS AI task security group에서만 6379 접근 허용
- 필요 시 TLS/auth token 사용

환경변수:

- `REDIS_URL`
- `REDIS_DEFAULT_TTL_SECONDS=600`
- `REDIS_CLEANUP_WORKER_ENABLED=true`
- `REDIS_CLEANUP_INTERVAL_SECONDS`

위험 요소:

- cleanup TTL 정책 미적용 시 raw transcript/raw vision/hidden score 잔존
- Redis 장애 시 면접 진행 상태 손실
- key namespace 충돌

## 4. Storage: local storage -> EFS first, S3 later

코드 수정 지점:

- `backend/src/storage/ports/storage.port.ts`
- `backend/src/storage/adapters/local-storage.adapter.ts`
- 즉시 AWS 배포 기준: Backend와 AI가 같은 EFS mount를 `BACKEND_STORAGE_ROOT`로 사용
- 장기 개선 기준: 신규 `S3StorageAdapter`
- `backend/src/files/files.service.ts`
- AI가 참조하는 `BACKEND_STORAGE_ROOT` 또는 S3 object resolver

인프라 변경 지점:

- 즉시 AWS 배포 기준: EFS 생성, Backend/AI ECS task에 같은 mount path 연결
- 장기 개선 기준: private S3 bucket 생성, public access block 유지, ECS task role에 최소 권한 부여
- temp 파일은 EFS cleanup worker 또는 S3 lifecycle rule 중 선택

환경변수:

- 즉시 AWS 배포 기준: `STORAGE_PROVIDER=local`
- 즉시 AWS 배포 기준: `BACKEND_STORAGE_ROOT=/mnt/app-storage`
- 장기 개선 기준: `STORAGE_PROVIDER=s3`, `S3_BUCKET`, `S3_REGION`, `S3_PRESIGNED_EXPIRES_SECONDS`

위험 요소:

- Backend와 AI가 서로 다른 storage root를 보면 Vision이 영상 파일을 찾지 못함
- raw video/raw frame image 장기 저장 금지 위반
- temp file cleanup 누락
- S3 전환 시 presigned URL 공개 범위 과다
- 사용자별 object ownership 검증 누락

## 5. FastAPI: local container -> ECS private service

코드 수정 지점:

- `ai/Dockerfile`
- `ai/app/api/deps.py`
- `ai/app/core/config.py`
- health check endpoint 유지

인프라 변경 지점:

- ECR repository
- ECS Fargate service
- private subnet 배치
- internal service discovery 또는 internal load balancer
- CloudWatch logs

환경변수:

- `INTERNAL_SHARED_SECRET`
- `REDIS_URL`
- `OPENAI_API_KEY`
- `OPENAI_JOB_ANALYSIS_MODEL`
- `OPENAI_STT_MODEL`
- `COVER_LETTER_RAG_DB_PATH`

위험 요소:

- FastAPI public 노출 금지
- secret mismatch로 NestJS 내부 호출 실패
- LLM/STT provider rate limit
- MediaPipe/OpenCV native dependency 누락

## 6. NestJS: local container -> ECS public service

코드 수정 지점:

- `backend/Dockerfile`
- `backend/src/ai-client/ai-client.service.ts`
- `backend/src/main.ts`
- Swagger 노출 정책

인프라 변경 지점:

- ECR repository
- ECS Fargate service
- public ALB
- ACM certificate
- WAF 선택
- CloudWatch logs

환경변수:

- `PORT`
- `FRONTEND_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `AI_INTERNAL_BASE_URL`
- `AI_INTERNAL_SHARED_SECRET`

위험 요소:

- CORS origin 불일치
- JWT secret 회전 정책 부재
- AI 내부 API timeout/retry 과다
- Swagger 운영 공개 범위

## 7. Frontend: local Next.js -> Amplify

코드 수정 지점:

- `frontend/src/lib/api.ts`
- `frontend/.env.example`

인프라 변경 지점:

- Amplify app
- custom domain
- build environment variables

환경변수:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`

위험 요소:

- API base URL 빌드 타임 주입 누락
- 인증 콜백 도메인 불일치
- 브라우저 CORS 오류

## 8. CI/CD: GitHub Actions + OIDC + ECR

코드 수정 지점:

- `.github/workflows/*`
- Docker image tag 정책
- migration 실행 job 분리

인프라 변경 지점:

- GitHub OIDC provider
- IAM role
- ECR push 권한
- ECS deploy 권한

환경변수/시크릿:

- AWS account/region
- ECR repository names
- ECS cluster/service names
- non-secret env는 workflow variables
- secret은 AWS Secrets Manager 또는 GitHub Encrypted Secrets

위험 요소:

- long-lived AWS key 사용
- migration과 app deploy 순서 역전
- rollback 전략 부재

## 9. Cleanup: local worker -> EventBridge + worker

코드 수정 지점:

- `ai/app/services/interview/cleanup_service.py`
- `ai/app/adapters/redis_state_store.py`
- storage temp deletion adapter

인프라 변경 지점:

- EventBridge schedule
- cleanup worker ECS task 또는 FastAPI 내부 worker 유지
- CloudWatch metric/log alarm

환경변수:

- `TEMP_FILE_RETENTION_SECONDS=600`
- `DELETE_FINISHED_SESSION_AFTER_SECONDS=600`
- `REDIS_CLEANUP_WORKER_ENABLED`

위험 요소:

- 중복 worker 실행 시 race condition
- cleanup 실패 알림 부재
- 10분 내 삭제 정책 미검증

## 10. 이전 순서

1. RDS와 migration 검증
2. ElastiCache 연결 검증
3. S3 adapter 추가와 private download 검증
4. FastAPI ECS private service 배포
5. NestJS ECS public service 배포
6. Amplify frontend 배포
7. GitHub Actions 자동화
8. cleanup worker/EventBridge 전환

## 11. 2026-05-18 AWS 이전 코드 상태

완료된 방어:

- Backend는 `NODE_ENV=production`에서 약한 `JWT_SECRET`, 약한 `AI_INTERNAL_SHARED_SECRET`, localhost URL, `DB_SYNCHRONIZE=true`를 시작 단계에서 차단한다.
- Backend CORS는 `FRONTEND_URL`에 쉼표로 여러 origin을 넣을 수 있다.
- Frontend rewrite는 `BACKEND_INTERNAL_API_BASE_URL`을 우선 사용하고, 없으면 `NEXT_PUBLIC_API_BASE_URL`, 마지막으로 로컬 backend를 사용한다.
- Backend Docker와 Frontend Docker는 pnpm frozen install 기준으로 빌드된다.
- Backend `packageManager`는 `pnpm@10.32.1`로 고정되어 Docker Corepack과 로컬 lockfile이 같은 기준을 사용한다.
- 운영 dependency audit 기준 Backend/Frontend 모두 알려진 취약점 0개 상태다.

AWS 배포 직전 필수값:

- `NODE_ENV=production`
- `FRONTEND_URL=https://실제-프론트-도메인`
- `NEXT_PUBLIC_API_BASE_URL=https://실제-backend-도메인`
- `BACKEND_INTERNAL_API_BASE_URL=https://실제-backend-도메인`
- `JWT_SECRET`: 32자 이상 강한 값, Secrets Manager 보관
- `AI_INTERNAL_SHARED_SECRET`: 32자 이상 강한 값, Backend와 AI 동일
- `DB_SYNCHRONIZE=false`
- `AI_INTERNAL_BASE_URL`: ECS 내부 AI 주소, localhost 금지
- `REDIS_URL`: ElastiCache 주소
- `OPENAI_API_KEY`: 실제 사용 시 Secrets Manager 보관

아직 AWS 전환 전 남은 확인:

- EFS mount path를 Backend/AI 양쪽에 같은 `BACKEND_STORAGE_ROOT`로 연결
- 실제 면접 영상 샘플로 Vision 정상 케이스 검증
- RDS 신규 DB에 migration 적용 검증

# Local Integration Checklist

## 1. 목적

이 문서는 `자료/단계별 진행가이드.txt` 16단계의 로컬 통합 테스트 기준을 실제 확인 가능한 체크리스트로 고정한다.

## 2. 사전 조건

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`
- Backend Swagger: `http://localhost:3001/docs`
- AI: `http://localhost:8000`
- PostgreSQL, Redis 실행
- `AI_INTERNAL_SHARED_SECRET`와 `INTERNAL_SHARED_SECRET` 값 일치

Docker 기준:

```bash
docker compose up --build
```

직접 실행 기준:

```bash
cd ai && uvicorn app.main:app --reload
cd backend && pnpm run start:dev
cd frontend && pnpm dev
```

## 3. 샘플 데이터

공고/JD:

```json
{
  "manualCompanyName": "OpenAI Korea",
  "manualPositionName": "Backend Engineer",
  "manualJdText": "Python, FastAPI, PostgreSQL, Redis 기반 백엔드 서비스 개발 및 운영 경험. API 설계, 장애 대응, 협업 경험 우대."
}
```

자소서:

```text
저는 FastAPI와 PostgreSQL을 사용해 채용 관리 서비스를 구현했습니다. API 설계, 인증, 배포 자동화 작업을 담당했고 장애 로그를 분석해 응답 속도를 개선했습니다.
```

면접 텍스트 fallback 답변:

```text
해당 프로젝트에서 저는 백엔드 API 설계와 Redis 캐시 적용을 담당했습니다. 조회가 많은 화면의 응답 시간이 길어지는 문제가 있었고, 쿼리 로그를 분석한 뒤 캐시 키 정책을 정리해 평균 응답 시간을 줄였습니다.
```

## 4. 통합 시나리오

1. 회원가입
   - 기대 결과: JWT 기반 로그인 가능 계정 생성
   - 확인 위치: Backend `users` 관련 API 응답, 프론트 로그인 상태

2. 로그인
   - 기대 결과: access token 저장, 인증 필요 메뉴 접근 가능
   - 실패 시 확인: `JWT_SECRET`, `FRONTEND_URL`, 브라우저 콘솔

3. 공고 분석
   - 요청: `/jobs/analyze`
   - 기대 결과: `jobAnalysisRequestId`, `companyName`, `positionName`, `jdText`, `sourceType` 반환
   - DB 확인: `job_analysis_requests` row 생성

4. 자소서 피드백 생성
   - 요청: `/ai/cover-letter/feedback`
   - 기대 결과: 총점, 요약, 강점 3개, 보완점 3개, 수정 방향 3개 반환
   - DB 확인: `cover_letter_reports` row 생성

5. 자소서 리포트 재조회
   - 요청: `/ai/cover-letter/reports`, `/ai/cover-letter/reports/:reportId`
   - 기대 결과: 방금 생성한 리포트가 목록/상세에서 조회됨

6. 면접 세션 시작
   - 요청: `/ai/interview/sessions/start`
   - 기대 결과: `firstQuestion`이 `1분 자기소개 부탁드립니다.`로 반환
   - 문서 충분도:
     - JD + 사용자 문서 1개 이상: `SUFFICIENT`
     - JD만 있음: `JD_ONLY`
     - 둘 다 부족: `INSUFFICIENT` 및 시작 차단
   - DB 확인: `interview_sessions` row 생성
   - Redis 확인: `interview:session:{sessionId}:state`

7. 답변 저장 5회 이상
   - 요청: `/ai/interview/sessions/:sessionId/answers`
   - 기대 결과: 턴별 피드백, 다음 질문 또는 완료 신호 반환
   - DB 확인: 정상 답변 턴만 `interview_turns`에 저장

8. STT fallback
   - 짧은 영상 또는 빈 답변으로 재업로드 조건 유도
   - 기대 결과: 같은 턴 최대 2회 retry 후 `REQUEST_TEXT`
   - 텍스트 답변 제출 시 기대 결과: `answer_full_text` 저장, 비언어 점수 0점 처리
   - Redis 확인: `stt-retry` key

9. Vision invalidation
   - 다중 얼굴/얼굴 미검출/저조도 케이스를 제출
   - 기대 결과: `visionResultStatus`가 `INVALID`, `WEAKENED`, `SKIPPED` 중 하나로 반환되며 면접 흐름은 계속 진행

10. 세션 종료
    - 요청: `/ai/interview/sessions/:sessionId/finish`
    - 5문항 이상 기대 결과: `FINISHED`, 최종 리포트 생성
    - 5문항 미만 기대 결과: `CANCELLED`, 리포트 없음
    - DB 확인: `final_total_score`, `final_grade`, `final_summary`

11. 리포트 재조회
    - 요청: `/ai/interview/sessions`, `/ai/interview/sessions/:sessionId`, `/ai/interview/sessions/:sessionId/turns`
    - 기대 결과: 질문, 답변, 피드백, 최종 리포트 조회 가능

12. 10분 cleanup
    - 기대 결과: raw transcript, raw vision metrics, hidden score, session intermediate state, temp answer video 삭제 대상 처리
    - Redis 확인: cleanup deadline 이후 관련 key 제거

## 5. 자동 검증 명령

```bash
cd ai && pytest
cd backend && npm test -- --runInBand
cd frontend && npm run build
```

현재 자동 테스트는 계약/규칙 단위 검증과 빌드 검증이다. 전체 브라우저 E2E는 이 문서의 수동 시나리오를 기준으로 수행한다.

## 6. 2026-05-16 로컬 실행 결과

확인한 항목:

- `docker compose up --build -d` 성공
- `docker compose ps` 기준 AI, Backend, PostgreSQL, Redis healthy, Frontend 실행
- Frontend `pnpm run build` 성공
- Frontend Docker 로그에서 Next.js 15.5.18 `next start` 실행 확인
- Backend 루트 health 응답: `200 OK`, `Hello World!`
- 회원가입/로그인 후 `/users/me` 보호 API 접근 성공
- `/jobs/analyze` 성공, `jobAnalysisRequestId` 생성
- `/ai/cover-letter/feedback` 성공, 리포트 생성
- Vision MediaPipe backend로 얼굴 미검출 샘플 영상 분석 성공: `status=INVALID`
- temp cleanup 실제 실행 후 orphan 후보 14개 삭제, 재 dry-run 결과 삭제 후보 0개

제한:

- 실제 얼굴이 포함된 영상 파일은 저장소에 없어서, Vision 정상 얼굴 점수 케이스는 추가 샘플 확보 후 확인해야 한다.
- 전체 브라우저 클릭 E2E는 API 기반 로컬 시나리오 검증으로 대체했다.

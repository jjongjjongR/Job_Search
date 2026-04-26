# 면접 AI 8~12단계 점검 문서

## 목적

이 문서는 `자료/단계별 진행가이드.txt`, `자료/project_v8.txt`, `자료/프로젝트_기준사항v9.txt`, `docs/ai-contract.md`, `docs/interview-rules.md`를 기준으로 면접 AI 8~12단계 구현 상태를 점검한 결과를 정리한다.

## 점검 범위

- 8단계: 면접 세션 시작 로직
- 9단계: 질문 생성 엔진
- 10단계: 답변 평가 엔진
- 11단계: STT fallback
- 12단계: Vision 보조 평가

## 점검 결과 요약

### 8단계

완료 항목:
- 문서 충분도 `SUFFICIENT / JD_ONLY / INSUFFICIENT` 판단 구현
- 첫 질문 `1분 자기소개` 고정
- `interview_sessions` 저장
- Redis session state 초기화

보정한 항목:
- `INSUFFICIENT`일 때 세션 시작을 막도록 수정
- 공개 API가 `jobAnalysisRequestId` 재사용 입력을 받을 수 있도록 수정

현재 기준:
- `jobAnalysisRequestId`가 있으면 저장된 공고 분석 결과로 시작 가능
- 직접 입력 `companyName / positionName / jdText`도 fallback으로 유지

### 9단계

완료 항목:
- 10문항 고정 질문 계획 생성
- 질문 타입 분배 고정
- `question planner`와 `next question resolver` 분리
- 꼬리질문 최대 2회 제한 반영
- 중복 질문 방지 최소 로직 반영
- 질문 길이 120자 제한 보정

보정한 항목:
- `JD_ONLY`일 때 문서 심층 질문 대신 JD + 공통 질문 중심으로 약화되도록 수정

### 10단계

완료 항목:
- 점수 항목 분리
  - 질문 적합성
  - 구체성
  - 근거/성과
  - 직무 적합성
  - 논리성/구조
  - 진정성/태도
- 충분성 기준
  - 질문 적합성 15/20 이상
  - 구체성 15/20 이상
  - 직무 적합성 12/15 이상
  - 전체 내용 70/85 이상
  - 추가 조건 4개 중 3개 이상
- 부족 이유 목록 반환
- 꼬리질문 우선순위 반영
- OpenAI 사용 가능 시 구조화된 JSON 평가 경로 추가
- OpenAI 미사용/실패 시 규칙 기반 fallback evaluator 유지

### 11단계

완료 항목:
- 같은 턴 최대 2회 재업로드 허용
- 실패 조건 반영
  - 1문장 이하 + 핵심 명사 부족
  - 3초 이하 영상
  - 음성 없음
  - 심한 잡음
- 2회 실패 시 `REQUEST_TEXT`
- 텍스트 전환 시 비언어 0점
- retry count Redis 저장

보정한 항목:
- 재업로드/텍스트 전환 요청은 정상 턴으로 DB 저장하지 않도록 처리

### 12단계

완료 항목:
- Vision 최소 지표 반영
  - 얼굴 유지율
  - 다중 얼굴
  - 저조도
  - 가림
  - gaze proxy
- 상태값 반영
  - `VALID`
  - `WEAKENED`
  - `INVALID`
  - `SKIPPED`
- 얼굴 유지율 낮음 -> 0점
- 다중 얼굴 -> 해당 턴 무효
- 저조도/가림 -> 약화
- Vision 실패해도 전체 흐름 계속 진행

보정한 항목:
- 면접 답변 응답에 `visionResultStatus`를 추가해 자료/API 명세와 맞춤

## 최종 판단

### 완료로 볼 수 있는 항목

- 8단계: 완료
- 9단계: 완료
- 10단계: 완료
- 11단계: 완료
- 12단계: 완료

## 이번 점검에서 실제 수정한 내용

- `INSUFFICIENT` 세션 시작 차단
- `jobAnalysisRequestId` 기반 면접 시작 지원
- `JD_ONLY` 질문 흐름 약화
- `visionResultStatus` 응답 추가
- OpenAI structured JSON 평가 + 서버 검증 fallback 추가
- 공개 API 4xx 에러 매핑 개선

## 관련 파일

- `ai/app/services/interview/start_service.py`
- `ai/app/services/interview/question_planner.py`
- `ai/app/services/interview/answer_service.py`
- `ai/app/schemas/interview.py`
- `backend/src/interview/dto/interview-session.dto.ts`
- `backend/src/interview/interview.service.ts`
- `backend/src/interview/interview.module.ts`
- `backend/src/ai-client/ai-client.service.ts`

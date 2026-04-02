# Storage Policy

## 1. 목적

이 문서는 AI 파트에서 저장해야 하는 데이터와 저장하면 안 되는 데이터를 구현 가능한 저장소 이름으로 구분한 문서다.

## 2. 저장소 역할

### 2-1. private durable storage

역할:

- 장기 보관해야 하는 파일 저장
- 사용자 업로드 문서 저장
- 자료실 파일 저장
- 필요 시 결과 산출물 파일 저장

예시:

- resume file
- cover letter file
- portfolio file
- dataroom file

### 2-2. private temp storage

역할:

- 세션 중간 처리용 임시 파일 저장
- 세션 종료 후 10분 내 삭제 대상 저장

예시:

- temp answer video
- raw transcript json
- raw vision metrics json

### 2-3. Redis temp state

역할:

- 세션 중간 상태 저장
- hidden score 저장
- 재시도 횟수 저장
- cleanup deadline 저장

예시:

- current session state
- stt retry count
- follow-up count
- hidden score

## 3. 영구 저장 데이터

PostgreSQL 영구 저장 대상:

- `interview_sessions`
- `interview_turns`
- `question_text`
- `answer_video_title`
- `answer_full_text`
- `feedback_text`
- `nonverbal_summary_text`
- `final report`
- `cover_letter_reports`
- `job_analysis_requests`

영구 저장 필드 예시:

### 3-1. `interview_sessions`

- id
- user_id
- company_name
- position_name
- document_sufficiency
- status
- total_question_count
- final_score
- final_summary
- final_strengths_json
- final_weaknesses_json
- final_practice_directions_json
- started_at
- finished_at

### 3-2. `interview_turns`

- session_id
- turn_number
- question_type
- question_text
- answer_video_title
- answer_full_text
- feedback_text
- nonverbal_summary_text
- vision_result_status
- created_at

`answer_full_text` 기준:

- `answer_full_text`는 raw transcript 원본이 아니다.
- `answer_full_text`는 사용자에게 다시 보여줄 답변 텍스트다.
- `answer_full_text`는 STT 결과를 바탕으로 만들되, 사용자가 실제 말한 흐름을 최대한 보존한다.
- `answer_full_text`는 말버릇, 반복어, 장황함을 제거하지 않는다.
- `answer_full_text`의 허용 보정은 띄어쓰기, 문장부호, 명백한 STT 깨짐 수정 정도로 제한한다.

### 3-3. `cover_letter_reports`

- id
- user_id
- job_analysis_request_id
- company_name
- position_name
- total_score
- summary
- strengths_json
- weaknesses_json
- revision_directions_json
- created_at

### 3-4. `job_analysis_requests`

- id
- user_id
- job_posting_url
- company_name
- position_name
- jd_text
- source_type
- created_at

## 4. 임시 저장 데이터

아래 데이터는 세션 종료 후 `10분 내 삭제`해야 한다.

- raw transcript
- raw vision metrics
- hidden score
- session intermediate state
- failed session temporary artifacts
- temp answer video

저장 위치:

- private temp storage
  - temp answer video
  - raw transcript json
  - raw vision metrics json
- Redis temp state
  - current session state
  - hidden score
  - stt retry count
  - follow-up count
  - cleanup deadline

## 5. 저장하지 않는 데이터

장기 저장 금지 데이터:

- raw video
- raw frame image
- 세션 중간 계산 원본

설명:

- raw video는 장기 저장하지 않는다.
- raw frame image는 장기 저장하지 않는다.
- 내부 계산용 원본은 장기 저장하지 않는다.
- raw transcript 원본은 비영구 저장 대상이며 세션 종료 후 10분 내 삭제한다.

## 6. 삭제 정책

### 6-1. 삭제 시점

- 정상 종료:
  - 세션 종료 후 10분 내 삭제
- 실패 종료:
  - 세션 종료 후 10분 내 삭제
- 5문항 미만 종료:
  - 리포트 생성 없이 임시 데이터까지 삭제

### 6-2. 삭제 대상

- raw transcript
- raw vision metrics
- hidden score
- session intermediate state
- temp answer video

## 7. 저장 예시 JSON

### 7-1. 영구 저장 예시

```json
{
  "interviewSession": {
    "id": "ivs-001",
    "userId": "user-001",
    "companyName": "OpenAI Korea",
    "positionName": "Backend Engineer",
    "documentSufficiency": "SUFFICIENT",
    "status": "FINISHED",
    "totalQuestionCount": 10,
    "finalScore": 81,
    "finalSummary": "전반적으로 논리 구조는 좋지만 근거 설명은 더 필요합니다."
  },
  "interviewTurns": [
    {
      "turnNumber": 1,
      "questionType": "SELF_INTRO",
      "question_text": "1분 자기소개 부탁드립니다.",
      "answer_video_title": "answer-turn-1.mp4",
      "answer_full_text": "안녕하세요. 백엔드 직무에 지원한 홍길동입니다.",
      "feedback_text": "근거를 조금 더 보완하면 좋습니다.",
      "nonverbal_summary_text": "큰 장해 요소는 없었습니다.",
      "vision_result_status": "VALID"
    }
  ]
}
```

### 7-2. private temp storage 예시

```json
{
  "tempAnswerVideoKey": "interview/temp/video/ivs-001/turn-3.mp4",
  "rawTranscriptFileKey": "interview/temp/transcript/ivs-001/turn-3.json",
  "rawVisionMetricsFileKey": "interview/temp/vision/ivs-001/turn-3.json",
  "deleteAfterSeconds": 600
}
```

### 7-3. Redis temp state 예시

```json
{
  "sessionId": "ivs-001",
  "state": {
    "status": "IN_PROGRESS",
    "currentQuestionNumber": 3,
    "followUpCountForCurrentQuestion": 1,
    "sttRetryCount": 2,
    "hiddenScore": {
      "relevance": 16,
      "specificity": 13
    },
    "cleanupDeadline": "2026-03-30T12:10:00Z"
  }
}
```

## 8. 공통 에러 응답 형식

```json
{
  "errorCode": "STT_FAILED",
  "message": "음성 인식에 실패했습니다.",
  "retryable": true,
  "details": {
    "retryCount": 1
  }
}
```

## 9. AWS 전환 기준

- PostgreSQL 영구 저장:
  - RDS PostgreSQL
- `private durable storage`:
  - S3 private durable bucket
- `private temp storage`:
  - S3 private temp bucket 또는 temp prefix
- `Redis temp state`:
  - ElastiCache Redis

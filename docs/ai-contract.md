# AI Contract

## 1. 기준

이 문서는 `자료/API명세서_v9.xlsx`, `자료/프로젝트_기준사항v9.txt`, `자료/project_v8.txt`, `자료/단계별 진행가이드.txt`, `자료/AI_plan.docx`를 기준으로 정리한다.

우선순위는 항상 `자료` 폴더가 `docs`보다 높다.

## 2. 공개/내부 호출 원칙

- Frontend는 NestJS 공개 API만 호출한다.
- NestJS는 JWT 인증과 권한 검사를 처리한다.
- FastAPI는 외부에 직접 공개하지 않는다.
- NestJS만 FastAPI 내부 API를 호출한다.
- FastAPI 내부 API는 `x-internal-shared-secret` 헤더로 보호한다.
- AI 결과는 구조화 JSON으로 받고 서버 검증 후 저장한다.
- 평가 결과는 `evaluator -> evaluation_validator -> 서버 하네스`를 통과하기 전까지 final로 취급하지 않는다.
- validator 실패 시 재평가는 기본 1회만 허용하고, 재평가 후에도 실패하면 보수 점수 또는 fallback 결과를 사용한다.

## 3. 핵심 저장 원칙

- `answer_full_text`는 raw transcript 원본이 아니다.
- `answer_full_text`는 사용자에게 다시 보여줄 답변 텍스트다.
- `answer_full_text`는 사용자가 실제 말한 흐름을 최대한 보존한다.
- 말버릇, 반복어, 장황함은 제거하지 않는다.
- 허용 보정은 띄어쓰기, 문장부호, 명백한 STT 깨짐 수정 정도로 제한한다.
- raw transcript, raw vision metrics, hidden score, 세션 중간 상태, 실패 세션 임시 데이터는 세션 종료 후 10분 내 삭제한다.
- raw video와 raw frame image는 장기 저장하지 않는다.
- 평가 validator raw response와 재평가 중간 결과는 장기 저장하지 않는다.
- 장기 저장 가능한 것은 사용자에게 보여줄 최종 리포트, 검증된 근거 요약, 턴별 질문/답변/피드백이다.

## 4. 공개 API

### 4-1. 공고 분석

- Method: `POST`
- Path: `/jobs/analyze`
- Auth: required

Request:

```json
{
  "jobPostingUrl": "https://example.com/jobs/123",
  "manualCompanyName": "OpenAI Korea",
  "manualPositionName": "Backend Engineer",
  "manualJdText": "백엔드 서비스 개발, PostgreSQL, AWS 경험 우대"
}
```

Response:

```json
{
  "jobAnalysisRequestId": "jar-001",
  "companyName": "OpenAI Korea",
  "positionName": "Backend Engineer",
  "jdText": "백엔드 서비스 개발, PostgreSQL, AWS 경험 우대",
  "sourceType": "URL"
}
```

`sourceType`은 `URL | MANUAL`만 사용한다.

### 4-2. 자소서 피드백 생성

- Method: `POST`
- Path: `/ai/cover-letter/feedback`
- Auth: required

Request:

```json
{
  "coverLetterText": "안녕하세요. 백엔드 개발자로...",
  "coverLetterDocumentId": "doc-cover-001",
  "resumeDocumentId": "doc-resume-001",
  "portfolioDocumentId": "doc-portfolio-001",
  "jobAnalysisRequestId": "jar-001",
  "companyName": "OpenAI Korea",
  "positionName": "Backend Engineer",
  "jdText": "백엔드 서비스 개발, PostgreSQL, AWS 경험 우대"
}
```

Response:

```json
{
  "reportId": "clr-001",
  "totalScore": 84,
  "confidence": 0.88,
  "evaluationValidation": {
    "valid": true,
    "confidence": 0.82,
    "reasons": [],
    "retryCount": 0
  },
  "summary": "JD와의 연결은 좋지만 성과 근거가 더 필요합니다.",
  "strengths": ["직무 키워드 반영이 좋습니다.", "지원 동기가 명확합니다.", "문장 흐름이 안정적입니다."],
  "weaknesses": ["본인 역할 설명이 약합니다.", "성과 수치가 부족합니다.", "프로젝트 근거가 추상적입니다."],
  "revisionDirections": ["프로젝트별 역할을 분리하세요.", "성과를 수치로 적으세요.", "직무 연결 문장을 보강하세요."]
}
```

`evaluationValidation`은 evaluator 결과가 근거성과 점수 일관성 검증을 통과했는지 나타내는 내부 검증 요약이다. 사용자 화면 노출은 선택 사항이며, raw validator response는 장기 저장하지 않는다.

### 4-3. 자소서 리포트 목록 조회

- Method: `GET`
- Path: `/ai/cover-letter/reports`
- Auth: required

Response:

```json
{
  "items": [
    {
      "reportId": "clr-001",
      "companyName": "OpenAI Korea",
      "positionName": "Backend Engineer",
      "totalScore": 84,
      "createdAt": "2026-03-30T12:00:00Z"
    }
  ]
}
```

### 4-4. 자소서 리포트 상세 조회

- Method: `GET`
- Path: `/ai/cover-letter/reports/:reportId`
- Auth: required

### 4-5. 면접 세션 시작

- Method: `POST`
- Path: `/ai/interview/sessions/start`
- Auth: required

Request:

```json
{
  "coverLetterDocumentId": "doc-cover-001",
  "resumeDocumentId": "doc-resume-001",
  "portfolioDocumentId": "doc-portfolio-001",
  "jobAnalysisRequestId": "jar-001",
  "companyName": "OpenAI Korea",
  "positionName": "Backend Engineer",
  "jdText": "백엔드 서비스 개발, PostgreSQL, AWS 경험 우대"
}
```

Response:

```json
{
  "sessionId": "ivs-001",
  "documentSufficiency": "SUFFICIENT",
  "interviewEnabled": true,
  "coverLetterEnabled": true,
  "firstQuestion": "1분 자기소개 부탁드립니다.",
  "status": "IN_PROGRESS"
}
```

문서 충분도:

- `SUFFICIENT`: JD 포함 + 사용자 문서 1개 이상
- `JD_ONLY`: JD만 있음
- `INSUFFICIENT`: JD도 없고 사용자 문서도 빈약함

`INSUFFICIENT`이면 면접 AI 기능을 비활성화한다.

### 4-6. 면접 답변 제출

- Method: `POST`
- Path: `/ai/interview/sessions/:sessionId/answers`
- Auth: required

자료 기준 논리 요청:

```json
{
  "videoFile": "multipart mp4|mov",
  "answerText": "STT 2회 실패 후 텍스트 답변",
  "answerVideoTitle": "answer-turn-1.mp4"
}
```

구현상 사전 업로드를 사용할 경우 `videoFile`은 private temp storage에 저장되고, 내부 처리에는 `answerVideoStorageKey`가 전달될 수 있다. 단, 공개 계약의 영구 저장 대상은 `answerVideoTitle`이며 raw video storage key는 장기 저장 대상이 아니다.

Response:

```json
{
  "done": false,
  "retryable": false,
  "nextQuestion": "해당 프로젝트에서 본인이 맡은 역할을 더 구체적으로 설명해 주세요.",
  "ttsUrl": null,
  "turnSummary": {
    "turnNo": 1,
    "questionType": "SELF_INTRO",
    "questionText": "1분 자기소개 부탁드립니다.",
    "answerVideoTitle": "answer-turn-1.mp4",
    "answerFullText": "안녕하세요. 백엔드 직무에 지원한 홍길동입니다.",
    "feedbackText": "본인 역할과 성과 근거를 더 구체화하면 좋습니다.",
    "nonverbalSummaryText": "얼굴 유지율은 안정적이었고 큰 장해 요소는 없었습니다.",
    "inputMode": "VIDEO",
    "evaluationValidation": {
      "valid": true,
      "confidence": 0.79,
      "reasons": [],
      "retryCount": 0
    }
  },
  "finalResult": null
}
```

면접 답변의 `evaluationValidation`은 `answer_full_text` 기준 평가가 실제 답변 근거와 맞는지 검증한 요약이다. retrievedEvidence는 맥락 참고용이며, 답변에 없는 내용을 점수 근거로 쓰면 validator에서 실패 처리한다.

### 4-7. 면접 세션 종료

- Method: `POST`
- Path: `/ai/interview/sessions/:sessionId/finish`
- Auth: required

5문항 이상 진행 시:

```json
{
  "reportGenerated": true,
  "deleted": false,
  "deletedReason": null,
  "finalResult": {
    "totalScore": 81,
    "grade": "우수",
    "summary": "전반적으로 논리 구조는 좋지만 근거 설명은 더 필요합니다.",
    "strengths": ["직무 연결이 잘 되었습니다.", "답변 흐름이 안정적입니다.", "협업 경험이 드러났습니다."],
    "weaknesses": ["성과 근거가 약합니다.", "역할 설명이 일부 추상적입니다.", "답변 길이 편차가 있습니다."],
    "practiceDirections": ["성과를 숫자로 정리하세요.", "프로젝트별 역할을 먼저 말하세요.", "직무 연결 문장으로 마무리하세요."]
  }
}
```

5문항 미만 또는 실패 세션:

```json
{
  "reportGenerated": false,
  "deleted": true,
  "deletedReason": "UNDER_MIN_TURNS",
  "finalResult": null
}
```

5문항 기준은 모든 질문을 포함한 실제 진행 문항 수 기준이다.

### 4-8. 면접 세션 목록 조회

- Method: `GET`
- Path: `/ai/interview/sessions`
- Auth: required

Response:

```json
{
  "items": [
    {
      "sessionId": "ivs-001",
      "companyName": "OpenAI Korea",
      "positionName": "Backend Engineer",
      "documentSufficiency": "SUFFICIENT",
      "status": "FINISHED",
      "totalQuestionCount": 10,
      "finalTotalScore": 84,
      "createdAt": "2026-03-30T12:00:00Z"
    }
  ]
}
```

### 4-9. 면접 세션 상세 조회

- Method: `GET`
- Path: `/ai/interview/sessions/:sessionId`
- Auth: required

세션 상세 응답에는 `documentSufficiency`가 포함되어야 한다.

### 4-10. 면접 턴 조회

- Method: `GET`
- Path: `/ai/interview/sessions/:sessionId/turns`
- Auth: required

Response:

```json
{
  "items": [
    {
      "turnNo": 1,
      "questionType": "SELF_INTRO",
      "questionText": "1분 자기소개 부탁드립니다.",
      "answerVideoTitle": "answer-turn-1.mp4",
      "answerFullText": "안녕하세요. 백엔드 직무에 지원한 홍길동입니다.",
      "feedbackText": "본인 역할과 성과 근거를 더 구체화하면 좋습니다.",
      "nonverbalSummaryText": "얼굴 유지율은 안정적이었고 큰 장해 요소는 없었습니다."
    }
  ]
}
```

## 5. 내부 API

내부 API는 NestJS만 호출한다.

- `POST /internal/jobs/analyze`
- `POST /internal/cover-letter/feedback`
- `POST /internal/interview/start`
- `POST /internal/interview/answer`
- `POST /internal/interview/finish`

내부 API는 공개 API와 같은 정책을 따르되, FastAPI 내부 처리에 필요한 `answerVideoStorageKey`, raw transcript 참조값, raw vision metrics 참조값을 사용할 수 있다. 이 값들은 영구 저장 대상이 아니다.

내부 평가 처리 공통 순서:

```text
평가 입력 정규화
-> evaluator agent 실행
-> evaluation_validator agent 실행
-> valid=true이면 서버 하네스 검증
-> valid=false이면 실패 이유를 evaluator에 전달해 1회 재평가
-> 재평가 후에도 실패하면 보수 점수 또는 fallback 결과 사용
-> 최종 결과만 NestJS로 반환
```

validator 공통 출력:

```json
{
  "valid": false,
  "confidence": 0.62,
  "reasons": ["근거 문장이 입력 문서에서 확인되지 않습니다."],
  "retryInstruction": "확인 가능한 근거만 사용해 점수를 보수적으로 다시 산정하세요.",
  "retryCount": 0
}
```

재평가는 기본 1회로 제한한다. validator는 최종 점수를 직접 생성하는 주체가 아니라, evaluator 결과가 다음 단계로 넘어갈 수 있는지 검사하는 하네스 hook이다.

## 6. 상태값

### 6-1. InterviewSessionStatus

- `IN_PROGRESS`
- `FINISHED`
- `FAILED`
- `CANCELLED`

`CANCELLED`는 사용자가 중간 종료했거나 5문항 미만으로 종료되어 리포트 없이 종료 처리된 상태다.

### 6-2. VisionResultStatus

- `VALID`: 정상 반영
- `WEAKENED`: 저조도/가림 등으로 점수 반영 약화
- `INVALID`: 다중 얼굴 등으로 해당 턴 Vision 무효
- `SKIPPED`: 텍스트 답변 전환 등으로 Vision 자체를 사용하지 않음

## 7. 공통 에러 코드

- `DOCUMENT_INSUFFICIENT`
- `FIRST_QUESTION_GENERATION_FAILED`
- `ANSWER_UPLOAD_FAILED`
- `STT_FAILED`
- `TEXT_ANSWER_REQUIRED`
- `VISION_INVALID`
- `NEXT_QUESTION_GENERATION_FAILED`
- `SESSION_TOO_SHORT_TO_REPORT`
- `TEMP_CLEANUP_PENDING`
- `INTERNAL_AI_UNAVAILABLE`
- `INTERNAL_AUTH_INVALID`
- `AI_EVALUATION_VALIDATION_FAILED`
- `AI_EVALUATION_RETRY_EXHAUSTED`
- `INVALID_REQUEST`

## 8. 저장 정책 요약

영구 저장:

- `interview_sessions`
- `interview_turns`
- `question_text`
- `answer_video_title`
- `answer_full_text`
- `feedback_text`
- `nonverbal_summary_text`
- 최종 리포트

세션 종료 후 10분 내 삭제:

- raw transcript
- raw vision metrics
- hidden score
- 세션 중간 상태
- 실패 세션 임시 분석 데이터
- 임시 업로드 답변 영상

장기 저장 금지:

- raw video
- raw frame image

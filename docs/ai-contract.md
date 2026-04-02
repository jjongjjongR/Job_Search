# AI Contract

## 1. 목적

이 문서는 `Next.js -> NestJS -> FastAPI` 구조에서 AI 파트 구현 시 사용할 API 계약 문서다.
공개 API는 NestJS가 제공하고, FastAPI는 내부 API만 제공한다.

## 2. 공개/내부 호출 원칙

- Frontend는 NestJS 공개 API만 호출한다.
- NestJS는 JWT 인증과 권한 검사를 처리한다.
- FastAPI는 외부에 직접 공개하지 않는다.
- NestJS만 FastAPI 내부 API를 호출한다.
- FastAPI는 `x-internal-shared-secret` 헤더를 검사한다.
- `answer_full_text`는 raw transcript 원본이 아니다.
- `answer_full_text`는 사용자에게 다시 보여줄 답변 텍스트다.
- `answer_full_text`는 STT 결과를 바탕으로 만들되, 사용자가 실제 말한 흐름을 최대한 보존한다.
- `answer_full_text`는 말버릇, 반복어, 장황함을 제거하지 않는다.
- `answer_full_text`의 허용 보정은 띄어쓰기, 문장부호, 명백한 STT 깨짐 수정 정도로 제한한다.
- raw transcript 원본은 비영구 저장 대상이며 세션 종료 후 10분 내 삭제한다.

## 3. 공개 API 목록

## 3-1. 공고 분석

- Method: `POST`
- Path: `/jobs/analyze`

Request JSON:

```json
{
  "jobPostingUrl": "https://example.com/jobs/123",
  "manualJdText": ""
}
```

Response JSON:

```json
{
  "jobAnalysisRequestId": "jar-001",
  "companyName": "OpenAI Korea",
  "positionName": "Backend Engineer",
  "jdText": "백엔드 서비스 개발, PostgreSQL, AWS 경험 우대",
  "sourceType": "JOB_POSTING_URL"
}
```

## 3-2. 자소서 피드백 생성

- Method: `POST`
- Path: `/ai/cover-letter/feedback`

Request JSON:

```json
{
  "jobAnalysisRequestId": "jar-001",
  "coverLetterDocumentId": "doc-cover-001",
  "resumeDocumentId": "doc-resume-001",
  "portfolioDocumentId": "doc-portfolio-001"
}
```

Response JSON:

```json
{
  "reportId": "clr-001",
  "companyName": "OpenAI Korea",
  "positionName": "Backend Engineer",
  "totalScore": 84,
  "summary": "JD와의 연결은 좋지만 성과 근거가 더 필요합니다.",
  "strengths": [
    "직무 키워드 반영이 잘 되어 있습니다.",
    "지원 동기가 비교적 명확합니다.",
    "문장 흐름이 안정적입니다."
  ],
  "weaknesses": [
    "본인 역할 설명이 약합니다.",
    "성과 수치가 부족합니다.",
    "프로젝트 근거가 추상적입니다."
  ],
  "revisionDirections": [
    "프로젝트별 역할을 분리해서 쓰세요.",
    "성과를 수치로 적으세요.",
    "직무와 연결되는 문장을 마지막에 덧붙이세요."
  ]
}
```

## 3-3. 자소서 리포트 목록 조회

- Method: `GET`
- Path: `/ai/cover-letter/reports`

Response JSON:

```json
[
  {
    "reportId": "clr-001",
    "companyName": "OpenAI Korea",
    "positionName": "Backend Engineer",
    "totalScore": 84,
    "createdAt": "2026-03-30T12:00:00Z"
  }
]
```

## 3-4. 자소서 리포트 단건 조회

- Method: `GET`
- Path: `/ai/cover-letter/reports/:reportId`

Response JSON:

```json
{
  "reportId": "clr-001",
  "companyName": "OpenAI Korea",
  "positionName": "Backend Engineer",
  "totalScore": 84,
  "summary": "JD와의 연결은 좋지만 성과 근거가 더 필요합니다.",
  "strengths": [
    "직무 키워드 반영이 잘 되어 있습니다.",
    "지원 동기가 비교적 명확합니다.",
    "문장 흐름이 안정적입니다."
  ],
  "weaknesses": [
    "본인 역할 설명이 약합니다.",
    "성과 수치가 부족합니다.",
    "프로젝트 근거가 추상적입니다."
  ],
  "revisionDirections": [
    "프로젝트별 역할을 분리해서 쓰세요.",
    "성과를 수치로 적으세요.",
    "직무와 연결되는 문장을 마지막에 덧붙이세요."
  ],
  "createdAt": "2026-03-30T12:00:00Z"
}
```

## 3-5. 면접 세션 시작

- Method: `POST`
- Path: `/ai/interview/sessions/start`

Request JSON:

```json
{
  "jobAnalysisRequestId": "jar-001",
  "resumeDocumentId": "doc-resume-001",
  "coverLetterDocumentId": "doc-cover-001",
  "portfolioDocumentId": "doc-portfolio-001"
}
```

Response JSON:

```json
{
  "sessionId": "ivs-001",
  "documentSufficiency": "SUFFICIENT",
  "status": "IN_PROGRESS",
  "currentQuestionNumber": 1,
  "maxQuestionCount": 10,
  "question": {
    "questionType": "SELF_INTRO",
    "questionText": "1분 자기소개 부탁드립니다."
  }
}
```

## 3-6. 면접 답변 제출

- Method: `POST`
- Path: `/ai/interview/sessions/:sessionId/answers`

영상 답변 Request JSON:

```json
{
  "turnNumber": 1,
  "answerType": "VIDEO",
  "answerVideoFileId": "temp-video-001"
}
```

텍스트 답변 Request JSON:

```json
{
  "turnNumber": 1,
  "answerType": "TEXT",
  "answerText": "안녕하세요. 백엔드 직무에 지원한 홍길동입니다."
}
```

Response JSON:

```json
{
  "sessionId": "ivs-001",
  "turnNumber": 1,
  "evaluation": {
    "answer_full_text": "안녕하세요. 백엔드 직무에 지원한 홍길동입니다.",
    "feedback_text": "지원 동기는 보였지만 프로젝트 근거를 더 말하면 좋습니다.",
    "nonverbal_summary_text": "얼굴 유지율은 안정적이었고 큰 장해 요소는 없었습니다.",
    "vision_result_status": "VALID"
  },
  "decision": {
    "type": "FOLLOW_UP",
    "message": "답변의 본인 역할 설명이 부족하여 꼬리질문을 진행합니다.",
    "followUpCountForCurrentQuestion": 1,
    "nextQuestion": {
      "questionType": "FOLLOW_UP",
      "questionText": "해당 프로젝트에서 본인이 맡은 역할을 더 구체적으로 설명해 주세요."
    }
  }
}
```

## 3-7. 면접 세션 종료

- Method: `POST`
- Path: `/ai/interview/sessions/:sessionId/finish`

Request JSON:

```json
{
  "reason": "USER_FINISHED"
}
```

Response JSON:

```json
{
  "sessionId": "ivs-001",
  "status": "FINISHED",
  "finalReport": {
    "totalScore": 81,
    "summary": "전반적으로 논리 구조는 좋지만 근거 설명은 더 필요합니다.",
    "strengths": [
      "직무 연결이 잘 되었습니다.",
      "답변 흐름이 안정적입니다.",
      "협업 경험이 잘 드러났습니다."
    ],
    "weaknesses": [
      "성과 근거가 약합니다.",
      "역할 설명이 일부 추상적입니다.",
      "답변 길이 편차가 있습니다."
    ],
    "practiceDirections": [
      "성과를 숫자로 정리하세요.",
      "프로젝트별 역할을 한 문장으로 먼저 말하세요.",
      "마지막 문장을 직무 연결로 닫으세요."
    ]
  }
}
```

## 3-8. 면접 세션 목록 조회

- Method: `GET`
- Path: `/ai/interview/sessions`

Response JSON:

```json
[
  {
    "sessionId": "ivs-001",
    "companyName": "OpenAI Korea",
    "positionName": "Backend Engineer",
    "status": "FINISHED",
    "totalScore": 81,
    "createdAt": "2026-03-30T12:00:00Z"
  }
]
```

## 3-9. 면접 세션 단건 조회

- Method: `GET`
- Path: `/ai/interview/sessions/:sessionId`

Response JSON:

```json
{
  "sessionId": "ivs-001",
  "companyName": "OpenAI Korea",
  "positionName": "Backend Engineer",
  "status": "FINISHED",
  "documentSufficiency": "SUFFICIENT",
  "totalQuestionCount": 10,
  "totalScore": 81,
  "finalSummary": "전반적으로 논리 구조는 좋지만 근거 설명은 더 필요합니다."
}
```

## 3-10. 면접 턴 목록 조회

- Method: `GET`
- Path: `/ai/interview/sessions/:sessionId/turns`

Response JSON:

```json
[
  {
    "turnNumber": 1,
    "questionType": "SELF_INTRO",
    "question_text": "1분 자기소개 부탁드립니다.",
    "answer_full_text": "안녕하세요. 백엔드 직무에 지원한 홍길동입니다.",
    "feedback_text": "프로젝트 근거를 조금 더 보완하면 좋습니다.",
    "nonverbal_summary_text": "큰 장해 요소는 없었습니다."
  }
]
```

## 4. 내부 API 목록

## 4-1. 공고 분석

- Method: `POST`
- Path: `/internal/jobs/analyze`

Request JSON:

```json
{
  "userId": "user-001",
  "jobPostingUrl": "https://example.com/jobs/123",
  "manualJdText": ""
}
```

Response JSON:

```json
{
  "companyName": "OpenAI Korea",
  "positionName": "Backend Engineer",
  "jdText": "백엔드 서비스 개발, PostgreSQL, AWS 경험 우대",
  "sourceType": "JOB_POSTING_URL"
}
```

## 4-2. 자소서 피드백 생성

- Method: `POST`
- Path: `/internal/cover-letter/feedback`

Request JSON:

```json
{
  "userId": "user-001",
  "jobAnalysis": {
    "companyName": "OpenAI Korea",
    "positionName": "Backend Engineer",
    "jdText": "백엔드 서비스 개발, PostgreSQL, AWS 경험 우대"
  },
  "documents": {
    "coverLetterText": "저는 백엔드 개발자로...",
    "resumeText": "경력 요약...",
    "portfolioText": "프로젝트 소개..."
  }
}
```

Response JSON:

```json
{
  "totalScore": 84,
  "summary": "JD와의 연결은 좋지만 성과 근거가 더 필요합니다.",
  "strengths": [
    "직무 키워드 반영이 잘 되어 있습니다.",
    "지원 동기가 비교적 명확합니다.",
    "문장 흐름이 안정적입니다."
  ],
  "weaknesses": [
    "본인 역할 설명이 약합니다.",
    "성과 수치가 부족합니다.",
    "프로젝트 근거가 추상적입니다."
  ],
  "revisionDirections": [
    "프로젝트별 역할을 분리해서 쓰세요.",
    "성과를 수치로 적으세요.",
    "직무와 연결되는 문장을 마지막에 덧붙이세요."
  ]
}
```

## 4-3. 면접 세션 시작

- Method: `POST`
- Path: `/internal/interview/start`

Request JSON:

```json
{
  "userId": "user-001",
  "companyName": "OpenAI Korea",
  "positionName": "Backend Engineer",
  "jdText": "백엔드 서비스 개발, PostgreSQL, AWS 경험 우대",
  "documents": {
    "coverLetterText": "저는 백엔드 개발자로...",
    "resumeText": "경력 요약...",
    "portfolioText": "프로젝트 소개..."
  }
}
```

Response JSON:

```json
{
  "documentSufficiency": "SUFFICIENT",
  "question": {
    "questionType": "SELF_INTRO",
    "questionText": "1분 자기소개 부탁드립니다."
  },
  "sessionState": {
    "status": "IN_PROGRESS",
    "currentQuestionNumber": 1,
    "followUpCountForCurrentQuestion": 0
  }
}
```

## 4-4. 면접 답변 처리

- Method: `POST`
- Path: `/internal/interview/answer`

영상 답변 Request JSON:

```json
{
  "userId": "user-001",
  "sessionId": "ivs-001",
  "turnNumber": 1,
  "answerType": "VIDEO",
  "answerVideoStorageKey": "interview/temp/video/ivs-001/turn-1.mp4"
}
```

텍스트 답변 Request JSON:

```json
{
  "userId": "user-001",
  "sessionId": "ivs-001",
  "turnNumber": 1,
  "answerType": "TEXT",
  "answerText": "안녕하세요. 백엔드 직무에 지원한 홍길동입니다."
}
```

Response JSON:

```json
{
  "answer_full_text": "안녕하세요. 백엔드 직무에 지원한 홍길동입니다.",
  "feedback_text": "지원 동기는 보였지만 프로젝트 근거를 더 말하면 좋습니다.",
  "nonverbal_summary_text": "얼굴 유지율은 안정적이었고 큰 장해 요소는 없었습니다.",
  "vision_result_status": "VALID",
  "decision": {
    "type": "FOLLOW_UP",
    "message": "답변의 본인 역할 설명이 부족하여 꼬리질문을 진행합니다.",
    "followUpCountForCurrentQuestion": 1,
    "nextQuestion": {
      "questionType": "FOLLOW_UP",
      "questionText": "해당 프로젝트에서 본인이 맡은 역할을 더 구체적으로 설명해 주세요."
    }
  }
}
```

## 4-5. 면접 세션 종료

- Method: `POST`
- Path: `/internal/interview/finish`

Request JSON:

```json
{
  "userId": "user-001",
  "sessionId": "ivs-001",
  "reason": "USER_FINISHED"
}
```

Response JSON:

```json
{
  "status": "FINISHED",
  "finishedAt": "2026-03-30T12:00:00Z",
  "finalReport": {
    "totalScore": 81,
    "summary": "전반적으로 논리 구조는 좋지만 근거 설명은 더 필요합니다.",
    "strengths": [
      "직무 연결이 잘 되었습니다.",
      "답변 흐름이 안정적입니다.",
      "협업 경험이 잘 드러났습니다."
    ],
    "weaknesses": [
      "성과 근거가 약합니다.",
      "역할 설명이 일부 추상적입니다.",
      "답변 길이 편차가 있습니다."
    ],
    "practiceDirections": [
      "성과를 숫자로 정리하세요.",
      "프로젝트별 역할을 한 문장으로 먼저 말하세요.",
      "마지막 문장을 직무 연결로 닫으세요."
    ]
  }
}
```

## 5. Decision 응답 구조

모든 면접 decision 응답은 아래 구조를 사용한다.

```json
{
  "type": "FOLLOW_UP",
  "message": "답변의 본인 역할 설명이 부족하여 꼬리질문을 진행합니다.",
  "retryCount": 1,
  "followUpCountForCurrentQuestion": 1,
  "nextQuestion": {
    "questionType": "FOLLOW_UP",
    "questionText": "해당 프로젝트에서 본인이 맡은 역할을 더 구체적으로 설명해 주세요."
  }
}
```

## 6. 공통 에러 응답 형식

모든 공개 API와 내부 API는 아래 형식을 사용한다.

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

## 7. 저장 정책 기준

- 영구 저장:
  - `interview_sessions`
  - `interview_turns`
  - `question_text`
  - `answer_video_title`
  - `answer_full_text`
  - `feedback_text`
  - `nonverbal_summary_text`
  - `final report`
- 임시 저장 후 세션 종료 10분 내 삭제:
  - `raw transcript`
  - `raw vision metrics`
  - `hidden score`
  - `session intermediate state`
  - `failed session temporary artifacts`
- 장기 저장 안 함:
  - `raw video`
  - `raw frame image`

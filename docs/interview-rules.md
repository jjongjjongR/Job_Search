# Interview Rules

## 1. 목적

이 문서는 면접 AI가 따라야 하는 규칙을 구현 가능한 이름과 형식으로 정리한 문서다.

## 2. 문서 충분도 규칙

### 2-1. `SUFFICIENT`

- 조건:
  - JD 포함
  - 사용자 문서 1개 이상 포함
- 처리:
  - 면접 AI 사용 가능
  - JD 기반 질문과 사용자 문서 기반 질문 진행

### 2-2. `JD_ONLY`

- 조건:
  - JD만 있음
- 처리:
  - 면접 AI 사용 가능
  - JD + 공통 질문 중심으로 진행
  - 문서 심층 질문은 약화

### 2-3. `INSUFFICIENT`

- 조건:
  - JD 없음
  - 사용자 문서도 빈약함
- 처리:
  - AI 기능 비활성화
  - 세션 시작 불가

## 3. 질문 구성 규칙

- 총 기본 질문 수: `10`
- 첫 질문: 반드시 `SELF_INTRO`
- 각 질문당 꼬리질문 최대 수: `2`
- 같은 세션에서 같은 의미 질문 반복 금지
- 질문 길이: `1~2문장`, `120자 이내 권장`

질문 타입:

- `SELF_INTRO`
- `MOTIVATION`
- `JD_FIT`
- `PROJECT_DEEP_DIVE`
- `OTHER_PROJECT`
- `COLLAB_PROBLEM_SOLVING`
- `CLOSING`
- `FOLLOW_UP`

권장 구성:

- `SELF_INTRO`: 1
- `MOTIVATION`: 1
- `JD_FIT`: 2
- `PROJECT_DEEP_DIVE`: 2
- `OTHER_PROJECT`: 2
- `COLLAB_PROBLEM_SOLVING`: 1
- `CLOSING`: 1

## 4. 답변 타입 규칙

- `VIDEO`
  - 기본 답변 방식
- `TEXT`
  - STT 2회 실패 후 전환 가능

`answer_full_text` 기준:

- `answer_full_text`는 raw transcript 원본이 아니다.
- `answer_full_text`는 사용자에게 다시 보여줄 답변 텍스트다.
- `answer_full_text`는 STT 결과를 바탕으로 만들되, 사용자가 실제 말한 흐름을 최대한 보존한다.
- `answer_full_text`는 말버릇, 반복어, 장황함을 제거하지 않는다.
- `answer_full_text`의 허용 보정은 띄어쓰기, 문장부호, 명백한 STT 깨짐 수정 정도로 제한한다.
- raw transcript 원본은 비영구 저장 대상이며 세션 종료 후 10분 내 삭제한다.

## 5. 답변 충분성 규칙

### 5-1. 점수 기준

- 질문 적합성: 20점 중 15점 이상
- 구체성: 20점 중 15점 이상
- 직무 적합성: 15점 중 12점 이상
- 전체 내용 점수: 85점 중 70점 이상

### 5-2. 내용 기준

아래 항목 중 3개 이상 만족하면 충분 답변으로 본다.

- 질문 의도에 직접 답함
- 본인 역할이 드러남
- 근거나 결과가 있음
- 직무와 연결됨

### 5-3. 불충분 판단 기준

아래 중 하나라도 강하게 걸리면 꼬리질문 후보로 본다.

- 질문 의도에 직접 답하지 않음
- 본인 역할이 모호함
- 결과/근거가 없음
- 직무 연결이 약함
- 너무 추상적임

## 6. Decision 규칙

Decision 타입:

- `RETRY_UPLOAD`
- `REQUEST_TEXT`
- `FOLLOW_UP`
- `NEXT_QUESTION`
- `FINISH_SESSION`

공통 구조:

- `type`
- `message`
- `retryCount` optional
- `followUpCountForCurrentQuestion` optional
- `nextQuestion` optional

예시 JSON:

```json
{
  "type": "FOLLOW_UP",
  "message": "답변의 본인 역할 설명이 부족하여 꼬리질문을 진행합니다.",
  "followUpCountForCurrentQuestion": 1,
  "nextQuestion": {
    "questionType": "FOLLOW_UP",
    "questionText": "그 프로젝트에서 본인이 맡은 역할을 구체적으로 설명해 주세요."
  }
}
```

## 7. 꼬리질문 규칙

- 꼬리질문은 반드시 직전 답변의 부족점과 연결해야 한다.
- 꼬리질문 우선순위:

1. 본인 역할/기여도
2. 성과/근거
3. 직무 연결
4. 전문성 디테일
5. 협업/태도 보완

다음 질문으로 넘어가는 조건:

- 답변이 충분하다고 판단됨
- 현재 질문의 꼬리질문 2회를 모두 사용함
- 전체 질문 수 10개에 도달함

## 8. STT fallback 규칙

- 기본 답변 타입은 `VIDEO`
- STT 실패 시 같은 턴에서 최대 2회 재업로드 허용
- 아래 조건이면 `STT_FAILED`로 본다.
  - 전사 결과가 1문장 이하이고 핵심 명사가 부족함
  - 영상 길이가 3초 이하임
  - 음성이 없음
  - 잡음이 심함
- 2회 실패하면 `REQUEST_TEXT` decision으로 전환
- 텍스트 답변 전환 시 비언어 평가는 0점 처리
- 텍스트 답변도 `answer_full_text`로 저장

STT 재시도 예시 JSON:

```json
{
  "type": "RETRY_UPLOAD",
  "message": "음성이 잘 들리지 않아 다시 업로드해 주세요.",
  "retryCount": 1
}
```

텍스트 전환 예시 JSON:

```json
{
  "type": "REQUEST_TEXT",
  "message": "음성 인식이 2회 실패하여 텍스트 답변으로 전환합니다."
}
```

## 9. Vision 규칙

- Vision은 감정 분석을 하지 않는다.
- Vision은 비언어 보조 평가만 한다.

Vision 결과 상태:

- `VALID`
- `WEAKENED`
- `INVALID`
- `SKIPPED`

처리 기준:

- 얼굴 유지율이 너무 낮음:
  - `INVALID`
  - 세션 비언어 점수 0점 처리
- 다중 얼굴 검출:
  - `INVALID`
  - 해당 턴 Vision 무효 처리
- 저조도/가림 심함:
  - `WEAKENED`
  - Vision 결과는 참고만 하고 점수 반영 약화
- 텍스트 답변 전환:
  - `SKIPPED`
  - 비언어 점수 0점 처리

## 10. 세션 종료 규칙

- 실제 진행 문항 수가 5문항 이상이면 리포트 생성
- 실제 진행 문항 수가 5문항 미만이면 평가하지 않고 임시 데이터까지 삭제
- 세션 종료 후 임시 데이터는 10분 내 삭제

삭제 대상:

- raw transcript
- raw vision metrics
- hidden score
- session intermediate state
- failed session temporary artifacts

세션 상태:

- `IN_PROGRESS`
- `FINISHED`
- `FAILED`
- `CANCELLED`

## 11. 에러 상태 정의

- `DOCUMENT_INSUFFICIENT`
- `FIRST_QUESTION_GENERATION_FAILED`
- `SESSION_NOT_FOUND`
- `TURN_NUMBER_MISMATCH`
- `ANSWER_UPLOAD_FAILED`
- `STT_FAILED`
- `TEXT_ANSWER_REQUIRED`
- `VISION_INVALID`
- `NEXT_QUESTION_GENERATION_FAILED`
- `SESSION_TOO_SHORT_TO_REPORT`
- `TEMP_CLEANUP_PENDING`
- `INTERNAL_AI_UNAVAILABLE`
- `INTERNAL_AUTH_INVALID`
- `INVALID_REQUEST`

공통 에러 응답 예시:

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

## 12. 면접 API 예시 JSON

### 12-1. 세션 시작 성공

```json
{
  "sessionId": "ivs-001",
  "documentSufficiency": "SUFFICIENT",
  "status": "IN_PROGRESS",
  "question": {
    "questionType": "SELF_INTRO",
    "questionText": "1분 자기소개 부탁드립니다."
  }
}
```

### 12-2. 세션 시작 실패

```json
{
  "errorCode": "DOCUMENT_INSUFFICIENT",
  "message": "JD 또는 사용자 문서가 부족하여 면접 세션을 시작할 수 없습니다.",
  "retryable": false,
  "details": {}
}
```

### 12-3. 꼬리질문 진행

```json
{
  "sessionId": "ivs-001",
  "turnNumber": 3,
  "evaluation": {
    "answer_full_text": "프로젝트를 진행했습니다.",
    "feedback_text": "프로젝트 설명은 있었지만 본인 역할이 부족합니다.",
    "nonverbal_summary_text": "비언어 장해 요소는 크지 않았습니다.",
    "vision_result_status": "VALID"
  },
  "decision": {
    "type": "FOLLOW_UP",
    "message": "본인 역할 설명이 부족하여 꼬리질문을 진행합니다.",
    "followUpCountForCurrentQuestion": 1,
    "nextQuestion": {
      "questionType": "FOLLOW_UP",
      "questionText": "그 프로젝트에서 본인이 맡은 역할을 구체적으로 설명해 주세요."
    }
  }
}
```

### 12-4. 다음 질문 진행

```json
{
  "sessionId": "ivs-001",
  "turnNumber": 3,
  "decision": {
    "type": "NEXT_QUESTION",
    "message": "현재 질문을 마치고 다음 질문으로 이동합니다.",
    "nextQuestion": {
      "questionType": "JD_FIT",
      "questionText": "이 직무와 가장 잘 맞는 본인의 경험은 무엇인가요?"
    }
  }
}
```

### 12-5. 세션 종료

```json
{
  "sessionId": "ivs-001",
  "status": "FINISHED",
  "finalReport": {
    "totalScore": 81,
    "summary": "전반적으로 논리 구조는 좋지만 근거 설명은 더 필요합니다."
  }
}
```

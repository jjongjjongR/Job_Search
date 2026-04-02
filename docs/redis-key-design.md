# Redis Key Design

## 1. 목적

이 문서는 면접 AI 임시 상태를 Redis temp state에 저장할 때 사용할 key 규칙을 정리한 문서다.

## 2. Key 규칙

- `interview:session:{sessionId}:state`
- `interview:session:{sessionId}:hidden-score:{turnNumber}`
- `interview:session:{sessionId}:raw-transcript:{turnNumber}`
- `interview:session:{sessionId}:raw-vision:{turnNumber}`
- `interview:session:{sessionId}:stt-retry:{turnNumber}`
- `interview:session:{sessionId}:cleanup`

## 3. 용도 설명

### 3-1. 세션 상태

- Key:
  - `interview:session:{sessionId}:state`
- 용도:
  - 현재 세션 상태 저장
- 예시 값:

```json
{
  "status": "IN_PROGRESS",
  "documentSufficiency": "SUFFICIENT",
  "currentQuestionNumber": 3,
  "followUpCountForCurrentQuestion": 1,
  "currentQuestionType": "FOLLOW_UP"
}
```

### 3-2. hidden score

- Key:
  - `interview:session:{sessionId}:hidden-score:{turnNumber}`
- 용도:
  - 내부 평가용 점수 저장
- 예시 값:

```json
{
  "relevance": 16,
  "specificity": 13,
  "jobFit": 12,
  "contentScore": 72
}
```

### 3-3. raw transcript

- Key:
  - `interview:session:{sessionId}:raw-transcript:{turnNumber}`
- 용도:
  - STT 원문 저장
- 예시 값:

```json
{
  "text": "안녕하세요. 백엔드 직무에 지원한 홍길동입니다.",
  "provider": "openai",
  "createdAt": "2026-03-30T12:00:00Z"
}
```

### 3-4. raw vision

- Key:
  - `interview:session:{sessionId}:raw-vision:{turnNumber}`
- 용도:
  - Vision 원시 지표 저장
- 예시 값:

```json
{
  "faceDetected": true,
  "multiFaceDetected": false,
  "lowLight": false,
  "occlusionDetected": false,
  "status": "VALID"
}
```

### 3-5. STT 재시도 수

- Key:
  - `interview:session:{sessionId}:stt-retry:{turnNumber}`
- 용도:
  - 해당 턴 STT 재시도 횟수 저장
- 예시 값:

```json
{
  "retryCount": 1
}
```

### 3-6. cleanup 정보

- Key:
  - `interview:session:{sessionId}:cleanup`
- 용도:
  - 임시 데이터 삭제 기한 저장
- 예시 값:

```json
{
  "deleteAfterSeconds": 600,
  "cleanupDeadline": "2026-03-30T12:10:00Z"
}
```

## 4. TTL 원칙

- 모든 key는 세션 종료 후 10분 내 삭제 대상이다.
- `cleanup` key는 삭제 작업 기준 시각을 담는다.
- 세션 실패 시에도 같은 규칙을 적용한다.

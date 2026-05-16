# AI Agent Architecture

## 1. 기준

이 문서는 `자료/AI_plan.docx`, `자료/project_v8.txt`, `자료/프로젝트_기준사항v9.txt`, `자료/단계별 진행가이드.txt`를 기준으로 작성한다.

Agent는 자율적으로 모든 판단을 대신하는 모델이 아니다. 이 프로젝트에서 Agent는 명시적 상태 그래프와 workflow orchestration을 뜻한다.

## 2. 역할 분리 원칙

- LLM: 텍스트 추론과 평가
- VLM: 문서 안 이미지형 정보 이해
- Agent: 상태 그래프와 흐름 제어
- Vision: 면접 비언어 보조 지표 추출
- Guardrail: LLM 결과를 서버 규칙으로 검증하고, 실패 시 fallback을 선택

역할을 섞지 않는다.

- VLM은 면접 영상 전체 평가에 쓰지 않는다.
- Vision은 감정 분석을 하지 않는다.
- 면접 평가는 `answer_full_text` 중심으로 유지한다.
- Vision은 15점 보조 평가만 담당한다.
- 모든 AI 결과는 구조화 JSON으로 받고 서버 검증 후 저장한다.
- 질문 생성, 꼬리질문, 최종 리포트는 사람마다 다른 JD/문서/답변 맥락을 반영해야 하므로 LLM agent를 우선 사용한다.
- LLM 결과는 그대로 신뢰하지 않고 타입, 길이, 반복, JD 근거, 사용자 답변 근거를 guardrail로 검증한다.

## 3. 자소서 Agent 구성

자소서 AI는 자유형 autonomous agent가 아니라 고정 workflow graph다.

권장 노드 이름:

1. `jd_analyzer`
2. `rag_retriever`
3. `document_vision`
4. `evidence_extractor`
5. `cover_letter_evaluator`
6. `draft_generator`
7. `draft_reviewer`
8. `END`

현재 기준 흐름:

```text
입력 문서
-> 텍스트 추출
-> 문서 이미지 추출
-> document_vision
-> jd_analyzer
-> rag_retriever
-> evidence_extractor
-> cover_letter_evaluator
-> draft_generator
-> draft_reviewer
-> 서버 검증
-> 리포트 저장
```

## 4. 자소서 Agent별 책임

### 4-1. `jd_analyzer`

- JD에서 회사명, 직무명, 핵심 요구 역량, 주요 키워드를 정리한다.
- URL 분석 실패 시 수동 입력값을 fallback으로 사용한다.

### 4-2. `rag_retriever`

- JD와 사용자 문서에서 관련 근거 후보를 찾는다.
- 현재 로컬/해시 기반 RAG는 비용과 안정성 중심이다.
- 고도화 단계에서는 embedding 기반 저장소로 교체 가능해야 한다.

### 4-3. `document_vision`

- VLM 기반 문서 이미지 이해 노드다.
- 포트폴리오 PDF의 아키텍처 그림, UI 캡처, 표, 그래프, 스캔 페이지를 설명 텍스트로 바꾼다.
- 출력은 `DocumentVisionResult` 계약을 따른다.
- VLM 결과는 점수에 바로 반영하지 않고 근거 후보로만 사용한다.

### 4-4. `evidence_extractor`

- 텍스트 추출 결과와 `document_vision` 결과를 합쳐 evidence 후보를 만든다.
- `source=textExtractor | documentVision`처럼 출처를 분리한다.
- 최종 저장 전 서버가 원문 대조와 검증을 수행할 수 있게 만든다.

### 4-5. `cover_letter_evaluator`

- JD 기준으로 자소서를 평가한다.
- totalScore, summary, strengths, weaknesses, revisionDirections를 구조화 JSON으로 만든다.
- LLM 결과는 서버 검증 전까지 final로 보지 않는다.

자료/요구사항 기준상 자소서 AI는 독립적인 자기소개서 생성 기능이 아니라 피드백/평가 기능이다. Draft 계열 Agent는 최종 제출본을 생성하지 않고, 사용자가 개선 방향을 이해하기 위한 수정 방향 예시만 만든다.

### 4-6. `draft_generator`

- 피드백을 바탕으로 수정 방향 예시를 만든다.
- 사용자가 쓰지 않은 경험을 새로 지어내면 안 된다.

### 4-7. `draft_reviewer`

- 수정 방향 예시가 JD와 근거에 맞는지 다시 검토한다.
- 과장 표현, 근거 없는 성과, 새 경험 생성 여부를 점검한다.

## 5. VLM 출력 계약

`DocumentVisionResult`:

```ts
{
  documentType: "PORTFOLIO" | "RESUME" | "JD" | "OTHER";
  pageNumber: number;
  elementType: "DIAGRAM" | "UI_SCREENSHOT" | "TABLE" | "CHART" | "SCANNED_TEXT" | "OTHER";
  summaryText: string;
  detectedKeywords: string[];
  evidenceCandidates: string[];
  confidence: number;
  verifiedByTextExtractor: boolean;
}
```

VLM 중간 산출물은 장기 저장하지 않는다.

- 페이지별 image crop
- raw OCR dump
- raw VLM response

장기 저장 가능한 것은 사용자에게 보여줄 가치가 있는 정리 결과뿐이다.

## 6. 면접 Agent 구성

면접 AI도 자유형 agent가 아니라 상태 기반 orchestration이다.

권장 노드 이름:

1. `session_start`
2. `question_planner`
3. `answer_stt`
4. `answer_evaluator`
5. `vision_analyzer`
6. `followup_resolver`
7. `next_question_resolver`
8. `report_generator`
9. `cleanup_scheduler`
10. `END`

## 7. 면접 Agent 흐름

```text
세션 시작
-> 문서 충분도 판단
-> 첫 질문 1분 자기소개 고정
-> 질문 계획 생성
-> 답변 영상 업로드
-> STT
-> answer_full_text 생성
-> LLM 내용 평가
-> Vision 비언어 보조 지표 분석
-> follow-up 또는 다음 질문 결정
-> 5문항 이상이면 최종 리포트 생성
-> 5문항 미만이면 CANCELLED 처리
-> cleanup 예약
```

## 8. 면접 Agent별 책임

### 8-1. `session_start`

- 문서 충분도를 판단한다.
- `SUFFICIENT`, `JD_ONLY`, `INSUFFICIENT`를 반환한다.
- `INSUFFICIENT`이면 AI 면접을 비활성화한다.
- 첫 질문은 반드시 1분 자기소개로 고정한다.

### 8-2. `question_planner`

- 총 10문항 기본 구성을 만든다.
- 질문 타입은 자료 기준 비율을 따른다.
- 질문은 1~2문장, 120자 이내를 권장한다.
- 동일 의미 질문 반복을 막는다.
- JD의 직무상세, 지원자격, 우대사항에서 핵심 역량을 뽑아 질문에 반영한다.
- 사용자 문서가 있으면 프로젝트 질문은 사용자 문서의 실제 경험을 기준으로 만든다.
- 사용자 문서가 부족하면 JD 역량을 준비한 학습/경험 질문으로 대체한다.
- 구현은 `LLM question_planner agent -> LLM question_guardrail agent -> 서버 하네스 검증 -> fallback planner` 순서를 따른다.
- `인턴십 역량`, `핵심 역량`처럼 근거가 약한 추상 질문은 실패 처리한다.

기본 구성:

- 1분 자기소개 1
- 우리 회사 지원동기 1
- 우리 JD 적합성 2
- 프로젝트 심층 2
- 다른 프로젝트 2
- 협업/문제해결 1
- 마무리 1

### 8-3. `answer_stt`

- 영상 답변에서 raw transcript를 만든다.
- raw transcript는 장기 저장하지 않는다.
- 사용자에게 보여줄 텍스트는 `answer_full_text`로 별도 정리한다.
- STT 실패 시 같은 턴에서 최대 2회 재업로드를 허용한다.
- 2회 실패 후 텍스트 답변으로 전환한다.

### 8-4. `answer_evaluator`

- `answer_full_text` 중심으로 답변을 평가한다.
- 내용 평가는 85점 기준이다.
- 평가 기준은 질문 적합성, 구체성, 근거/성과, 직무 적합성, 논리성/구조, 진정성/태도다.
- 충분 답변 여부와 부족 이유를 구조화 JSON으로 반환한다.

### 8-5. `vision_analyzer`

- Vision은 비언어 보조 지표만 계산한다.
- 감정 분석, 성격 추정, 인성 판단은 하지 않는다.
- 출력은 `VisionMetrics` 계약을 따른다.

`VisionMetrics`:

```ts
{
  faceDetectedRatio: number;
  multiFaceDetected: boolean;
  lowLight: boolean;
  obstructionDetected: boolean;
  gazeStable: boolean;
  status: "VALID" | "WEAKENED" | "INVALID" | "SKIPPED";
}
```

Vision provider는 교체 가능해야 한다.

- `mediapipe_backend`
- `yolo_backend`
- `insightface_backend`

외부 서비스는 provider 이름이 아니라 `VisionMetrics`만 본다.

### 8-6. `followup_resolver`

- 답변이 부족하면 꼬리질문을 만든다.
- 질문당 꼬리질문은 최대 2개다.
- follow-up은 반드시 직전 답변의 부족점과 연결한다.
- 구현은 `LLM followup_question_agent -> 서버 하네스 검증 -> fallback 문장` 순서를 따른다.
- 답변에 없는 역할, 성과, 경험을 있다고 가정한 꼬리질문은 실패 처리한다.
- 꼬리질문은 직전 질문, 직전 답변, JD를 모두 근거로 삼는다.

꼬리질문 우선순위:

1. 역할/기여도
2. 성과/근거
3. 직무 연결
4. 전문성 디테일
5. 협업/태도

### 8-7. `next_question_resolver`

- 충분 답변이면 다음 기본 질문으로 이동한다.
- 꼬리질문 제한에 도달하면 다음 기본 질문으로 이동한다.
- 세션 상태의 현재 질문 번호, 현재 질문 타입, follow-up count를 갱신한다.

### 8-8. `report_generator`

- 5문항 이상 진행 시 최종 리포트를 생성한다.
- 5문항 미만이면 리포트를 생성하지 않는다.
- 최종 점수는 100점 만점 정수다.
- 내용 85점, 비언어 15점 비율을 따른다.
- 총점과 등급은 서버가 계산하고, LLM은 누적 질문/답변/피드백을 바탕으로 요약, 강점, 보완점, 연습 방향을 작성한다.
- LLM 리포트 결과는 항목 수와 근거 범위를 guardrail로 검증한 뒤 저장한다.

리포트 구성:

- 총점
- 등급
- 전체 평가 요약
- 강점 3개
- 보완점 3개
- 연습 방향 3개
- 질문 목록-답변
- 턴별 피드백

### 8-9. `cleanup_scheduler`

- 세션 종료 후 cleanup deadline을 기록한다.
- raw transcript, raw vision metrics, hidden score, 세션 중간 상태, 실패 세션 임시 분석 데이터, 임시 업로드 답변 영상을 10분 내 삭제 대상으로 둔다.
- 5문항 미만 종료는 `CANCELLED` 상태이며 임시 데이터까지 삭제한다.

## 9. Agent 운영 규칙

- Agent는 모델이 아니라 흐름 제어자다.
- Agent가 모든 모델 코드를 직접 알지 않게 한다.
- 각 노드는 표준 입력/출력만 주고받는다.
- LLM/VLM/Vision provider는 인터페이스 뒤에 숨긴다.
- 평가와 생성 결과는 서버 규칙이 검증한 뒤 채택한다.
- raw 응답과 중간값은 영구 저장하지 않는다.
- 발표에서는 autonomous agent보다 명시적 상태 그래프라고 설명한다.

## 10. 관측성 고도화 항목

운영 고도화 단계에서는 아래 값을 기록한다.

- provider latency
- fallback rate
- 근거 검증 실패율
- VLM 사용 페이지 수
- VLM 성공률
- VLM 평균 처리 시간
- Vision invalidation 비율
- request id 기반 trace

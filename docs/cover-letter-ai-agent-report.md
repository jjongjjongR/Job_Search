# 자소서 AI Agent 구조 및 운영 보고서

## 1. 목적

자소서 AI의 목적은 사용자가 입력한 공고 분석 결과, 자기소개서, 이력서, 포트폴리오를 기준으로 자소서를 평가하고, 보완 방향과 수정 초안을 제공하는 것이다.

이 서비스는 AI가 점수를 임의로 찍는 구조가 아니라, `JD 분석 -> 지원자 근거 추출 -> 항목별 평가 -> 초안 생성 -> 초안 재검토 -> 서버 검증` 순서로 동작한다.

## 2. 전체 흐름

```text
NestJS 공개 API
  -> FastAPI 내부 API
  -> JD Analyzer Agent
  -> Evidence Extractor Agent
  -> Cover Letter Evaluator Agent
  -> Draft Generator Agent
  -> Draft Reviewer Agent
  -> 서버 검증 및 응답
  -> cover_letter_reports 저장
```

프론트는 FastAPI를 직접 호출하지 않고 NestJS의 `/ai/cover-letter/feedback`만 호출한다. NestJS는 로그인 사용자 ID와 저장된 `jobAnalysisRequestId`를 기준으로 공고 분석 결과를 찾아 FastAPI 내부 API로 전달한다.

## 3. Agent 구성

### 3-1. JD Analyzer Agent

파일: `ai/app/services/cover_letter/jd_analyzer_agent.py`

역할:
- JD 원문에서 핵심 키워드를 추출한다.
- 직무명과 JD를 기준으로 직무 초점 키워드를 추출한다.
- 추출된 키워드가 실제 JD 원문에 있는지 서버에서 다시 검증한다.

검증 기준:
- AI나 규칙이 뽑은 키워드라도 JD 원문에 없으면 평가 기준으로 쓰지 않는다.
- 예를 들어 JD에 `Java`가 없는데 AI가 `Java`를 뽑으면 `rejectedJdKeywords`로 밀려나고 `verifiedJdKeywords`에는 들어가지 않는다.

왜 필요한가:
- 공고 분석이 잘못되면 이후 자소서 평가도 전부 틀어진다.
- 그래서 첫 단계에서 “JD에 실제로 있는 기준만 통과”시키는 방어선이 필요하다.

### 3-2. Evidence Extractor Agent

파일: `ai/app/services/cover_letter/evidence_extractor_agent.py`

역할:
- 자기소개서, 이력서, 포트폴리오 텍스트를 정규화한다.
- 자기소개서를 문항 단위로 분리한다.
- JD 키워드가 사용자 문서에 얼마나 반영되어 있는지 계산한다.
- 이력서와 포트폴리오가 함께 들어왔는지 확인한다.

검증 기준:
- 자소서 본문은 직접 입력 텍스트와 파일 추출 텍스트 중 하나가 있어야 한다.
- 평가는 자소서만 보는 것이 아니라, 이력서와 포트폴리오 근거까지 함께 본다.

왜 필요한가:
- AI가 “좋아 보인다”라고 말하는 것이 아니라, 실제 사용자 문서에서 평가 근거를 찾기 위해 필요하다.

### 3-3. Cover Letter Evaluator Agent

파일: `ai/app/services/cover_letter/cover_letter_evaluator_agent.py`

역할:
- JD와 사용자 문서를 기준으로 자소서를 평가한다.
- 항목별 부분점수를 만든다.
- 강점, 약점, 수정 방향, 다음 액션을 생성한다.

평가 항목:
- JD 반영도: 25점
- 직무 적합도: 25점
- 경험 구체성: 20점
- 성과/근거: 15점
- 문항 적합성: 10점
- 문장 완성도: 5점

점수 검증 방식:
- AI가 항목별 점수와 `evidenceText`를 함께 반환한다.
- 서버는 `evidenceText`가 실제 자소서, 이력서, 포트폴리오, JD 안에 있는지 확인한다.
- 근거가 없으면 해당 항목 점수를 감점한다.
- 검증된 근거 비율을 바탕으로 `confidence`를 계산한다.

왜 필요한가:
- 자소서 점수는 완전한 정답이 있는 시험 점수가 아니다.
- 따라서 “AI 점수”보다 “근거가 검증된 참고 점수”로 만드는 것이 중요하다.

### 3-4. Draft Generator Agent

파일: `ai/app/services/cover_letter/draft_generator_agent.py`

역할:
- 평가 결과와 사용자 원문을 바탕으로 수정 초안을 생성한다.
- 문항 수를 원본과 맞춘다.
- 각 문항에 소제목을 붙인다.
- 마크다운 문법과 괄호가 보이지 않도록 평문으로 정리한다.

생성 기준:
- 원본에 없는 경험을 새로 만들지 않는다.
- 문항 수를 유지한다.
- `[문항 n] [소제목]` 형식을 지킨다.
- 역할, 행동, 결과, 직무 연결이 보이도록 다듬는다.

왜 필요한가:
- 사용자는 피드백만으로 끝나면 다음 행동을 하기 어렵다.
- 초안은 사용자가 어떻게 고치면 되는지 방향을 보여주는 학습용 결과물이다.

### 3-5. Draft Reviewer Agent

파일: `ai/app/services/cover_letter/draft_reviewer_agent.py`

역할:
- 생성된 수정 초안을 다시 검사한다.
- JD 연결, 과장 여부, 문항 수, 형식, 소제목 기준을 확인한다.

검토 기준:
- JD 핵심 요구와 연결되는가
- 입력 문서에 없는 내용을 새로 만들지 않았는가
- 문항 수가 원본과 같은가
- `[문항 n] [소제목]` 형식인가
- 소제목에 괄호가 들어가지 않았는가

왜 필요한가:
- 생성 AI는 초안을 그럴듯하게 만들 수 있지만, 입력 근거에 없는 내용을 섞을 수 있다.
- 그래서 초안을 사용자에게 보여주기 전에 한 번 더 검토한다.

## 4. 점수 신뢰도 구조

최종 점수는 AI가 한 번에 주는 점수가 아니다.

```text
AI 항목별 판단
  -> 서버 근거 검증
  -> 근거 없는 항목 감점
  -> 총점 재계산
  -> confidence 계산
```

응답에는 다음 정보가 포함된다.

```json
{
  "totalScore": 76,
  "confidence": 0.82,
  "verifiedJdKeywords": ["Python", "PyTorch", "RAG"],
  "rubricScores": [
    {
      "category": "JD 반영도",
      "score": 18,
      "maxScore": 25,
      "evidenceText": "검색 품질 개선 프로젝트에서 임베딩 기반 랭킹 개선을 맡아 CTR을 12% 높였습니다.",
      "evidenceSource": "coverLetter",
      "verified": true
    }
  ]
}
```

`confidence`는 점수 자체의 절대 신뢰도가 아니라, 점수 근거가 실제 입력 문서에서 얼마나 확인되었는지를 나타내는 값이다.

## 5. 보안 관점

적용된 기준:
- 프론트는 FastAPI를 직접 호출하지 않는다.
- NestJS 공개 API만 사용한다.
- FastAPI 내부 API는 `x-internal-shared-secret` 헤더를 검사한다.
- 자소서 리포트 조회/삭제는 로그인 사용자 본인의 리포트만 허용한다.
- 파일 입력은 원본 파일을 AI에 그대로 장기 저장하지 않고, 추출 텍스트 중심으로 처리한다.

주의할 점:
- AI 응답을 그대로 신뢰하지 않는다.
- JD 키워드와 점수 근거는 서버에서 다시 검증한다.
- 사용자 문서 원문은 외부 로그에 남기지 않는 것이 원칙이다.

## 6. 운영 관점

운영 시 확인할 항목:
- OpenAI 호출 실패 시 규칙 기반 fallback이 동작하는가
- `confidence`가 지나치게 낮은 리포트가 많이 생기지 않는가
- 근거 검증 실패 항목이 반복되는가
- 특정 JD에서 엉뚱한 키워드가 자주 추출되는가
- 리포트 저장/조회/삭제가 사용자 단위로 분리되는가

장애 대응:
- OpenAI 장애 시에도 최소 피드백은 생성된다.
- 점수는 fallback rubric으로 생성된다.
- 초안 생성이 실패해도 피드백 리포트는 반환 가능하다.

## 7. 질문 대응 요약

질문: AI가 JD에 없는 이상한 용어를 넣으면 어떻게 하나?

답변: JD Analyzer Agent가 뽑은 키워드는 서버에서 JD 원문 포함 여부를 다시 확인한다. JD에 없는 키워드는 `verifiedJdKeywords`에 들어가지 않고 평가 기준에서 제외된다.

질문: 점수는 AI가 주는 건가, 서버가 주는 건가?

답변: 항목별 판단은 AI가 한다. 하지만 서버가 각 항목의 근거가 실제 문서에 있는지 검증하고, 근거가 없으면 감점한 뒤 최종 점수와 confidence를 계산한다.

질문: 왜 rule 기반만 쓰지 않았나?

답변: 자소서 평가는 정답이 고정된 문제가 아니라서 rule만으로는 문맥 판단이 약하다. 대신 AI가 문맥을 판단하고, 서버가 근거와 범위를 검증하는 방식으로 신뢰도를 보강했다.

질문: 초안은 믿을 수 있나?

답변: 초안도 바로 보여주는 것이 아니라 Draft Reviewer Agent가 문항 수, 형식, JD 연결, 과장 여부를 다시 검사한다. 다만 초안은 최종 제출본이 아니라 사용자가 수정 방향을 이해하기 위한 학습용 결과물이다.

## 8. 현재 한계

- 현재 RAG는 벡터 DB 기반이 아니라 입력 문서 안에서 근거를 검증하는 1차 구조다.
- 향후 `pgvector`, `FAISS`, `Chroma` 중 하나를 붙이면 문서 chunk 검색 정확도를 더 높일 수 있다.
- LangGraph를 붙이면 현재 agent 함수들을 node로 승격해 실패 시 재시도, 낮은 confidence 시 재평가 같은 흐름을 더 명확히 제어할 수 있다.

## 9. 다음 고도화 방향

1. JD 분석 결과를 `requiredSkills`, `preferredSkills`, `responsibilities`, `evaluationCriteria`로 더 세분화한다.
2. 자소서/이력서/포트폴리오를 chunk로 나눠 RAG 검색을 붙인다.
3. LangGraph로 agent 실행 순서와 재시도 조건을 그래프로 관리한다.
4. `confidence`가 낮으면 초안 생성 전에 사용자에게 추가 자료 입력을 요청한다.
5. 리포트 상세 화면에서 항목별 근거와 confidence를 함께 보여준다.

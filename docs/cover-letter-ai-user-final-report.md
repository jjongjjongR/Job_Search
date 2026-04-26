# 자소서 AI 최종 설명 보고서

## 1. 자소서 AI 한 줄 설명

자소서 AI는 공고 JD와 사용자의 자기소개서, 이력서, 포트폴리오를 함께 분석해서 JD 적합도, 직무 적합도, 문항별 점수, 강점, 보완점, 다음 액션, 수정 초안을 생성하는 기능이다.

단순히 AI가 점수를 찍는 구조가 아니라, `LangGraph Agent 흐름`, `벡터 DB 기반 RAG`, `항목별 rubric 점수`, `서버 근거 검증`, `초안 재검토`를 거쳐 결과를 만든다.

## 2. 왜 이런 구조로 만들었는가

자소서 평가는 객관식 시험처럼 정답이 있는 문제가 아니다. 그래서 단순 rule 기반으로만 점수를 매기면 문맥 판단이 약하고, 반대로 AI에게만 맡기면 근거 없는 점수나 과장된 피드백이 나올 수 있다.

이 문제를 해결하기 위해 다음 구조를 선택했다.

```text
AI가 문맥을 판단한다.
RAG가 실제 근거를 찾아준다.
서버가 그 근거가 진짜 입력 문서에 있는지 검증한다.
LangGraph가 agent 실행 순서를 고정한다.
```

즉, 자소서 AI의 핵심은 “AI 판단 + 근거 검색 + 서버 검증”이다.

## 3. 전체 동작 흐름

사용자가 자소서 피드백을 요청하면 다음 순서로 진행된다.

```text
1. 사용자가 공고 분석 결과와 자소서/이력서/포트폴리오를 입력한다.
2. 프론트는 NestJS 공개 API만 호출한다.
3. NestJS는 로그인 사용자와 jobAnalysisRequestId를 확인한다.
4. NestJS가 FastAPI 내부 API로 요청을 넘긴다.
5. FastAPI에서 LangGraph가 실행된다.
6. JD Analyzer Agent가 JD 기준을 뽑는다.
7. RAG Retriever Agent가 관련 문서 근거를 검색한다.
8. Evidence Extractor Agent가 사용자 문서와 문항을 정리한다.
9. Evaluator Agent가 rubric 기준으로 평가한다.
10. 서버가 점수 근거를 다시 검증한다.
11. Draft Generator Agent가 수정 초안을 만든다.
12. Draft Reviewer Agent가 초안을 다시 검사한다.
13. 결과가 NestJS로 돌아온다.
14. NestJS가 cover_letter_reports에 저장한다.
15. 프론트와 마이페이지에서 결과를 확인한다.
```

## 4. 사용한 Agent 목록

### 4-1. JD Analyzer Agent

파일:

```text
ai/app/services/cover_letter/jd_analyzer_agent.py
```

역할:

- JD 원문에서 핵심 키워드를 추출한다.
- 직무명과 JD를 기준으로 직무 초점 키워드를 추출한다.
- 추출된 키워드가 실제 JD 원문에 있는지 검증한다.

중요 기준:

- JD 원문에 없는 키워드는 평가 기준으로 쓰지 않는다.
- 예를 들어 JD에 `Java`가 없는데 AI가 `Java`를 뽑아도 `verifiedJdKeywords`에 들어가지 않는다.

왜 필요한가:

- 공고 분석 기준이 잘못되면 자소서 평가 전체가 틀어진다.
- 그래서 첫 단계에서 JD 기준을 검증해야 한다.

출력 예시:

```json
{
  "jdKeywords": ["RAG", "Embedding", "Reranker", "Python"],
  "jobFocusKeywords": ["검색 품질 개선", "모델 최적화"],
  "rejectedJdKeywords": []
}
```

### 4-2. RAG Retriever Agent

파일:

```text
ai/app/services/cover_letter/rag_retriever_agent.py
```

역할:

- JD 분석 결과를 검색 query로 만든다.
- JD, 자소서, 이력서, 포트폴리오를 chunk로 나눈다.
- chunk를 벡터 저장소에 넣는다.
- JD와 관련 있는 근거 chunk를 검색한다.

검색 기준:

- JD 핵심 키워드
- 직무 초점 키워드
- JD 반영도
- 직무 적합도
- 경험 구체성
- 성과/근거
- 문항 적합성
- 문장 완성도

왜 필요한가:

- AI가 기억이나 추측으로 평가하지 않게 하기 위해서다.
- 평가 전에 실제 입력 문서에서 관련 근거를 먼저 찾는다.

출력 예시:

```json
{
  "source": "coverLetter",
  "text": "Embedding 기반 랭킹 개선을 맡아 CTR을 12% 높였습니다.",
  "score": 0.4211
}
```

### 4-3. Evidence Extractor Agent

파일:

```text
ai/app/services/cover_letter/evidence_extractor_agent.py
```

역할:

- 직접 입력 텍스트와 파일 추출 텍스트를 정리한다.
- 자소서를 문항 단위로 나눈다.
- 이력서와 포트폴리오가 들어왔는지 확인한다.
- RAG 검색 결과를 평가 agent가 쓸 수 있게 묶는다.

왜 필요한가:

- 자소서는 문항별 평가가 중요하다.
- 이력서와 포트폴리오까지 같이 봐야 사용자의 실제 경험 근거를 더 정확히 볼 수 있다.

### 4-4. Cover Letter Evaluator Agent

파일:

```text
ai/app/services/cover_letter/cover_letter_evaluator_agent.py
```

역할:

- JD와 RAG 근거를 바탕으로 자소서를 평가한다.
- 항목별 부분점수를 만든다.
- 강점, 약점, 수정 방향, 다음 액션을 만든다.

점수 기준:

| 항목 | 배점 | 보는 기준 |
| --- | --- | --- |
| JD 반영도 | 25점 | JD 핵심 요구가 자소서에 반영됐는가 |
| 직무 적합도 | 25점 | 경험이 지원 직무와 직접 연결되는가 |
| 경험 구체성 | 20점 | 역할, 행동, 과정이 구체적인가 |
| 성과/근거 | 15점 | 수치, 결과, 개선 근거가 있는가 |
| 문항 적합성 | 10점 | 문항에서 묻는 내용에 답하고 있는가 |
| 문장 완성도 | 5점 | 문장 흐름과 표현이 읽기 좋은가 |

중요 기준:

- AI가 전체 점수를 한 번에 찍지 않는다.
- AI는 항목별 점수와 근거 문장을 같이 낸다.
- 서버는 근거 문장이 실제 입력 문서에 있는지 검증한다.
- 근거가 없으면 해당 항목을 감점한다.

출력 예시:

```json
{
  "category": "성과/근거",
  "score": 12,
  "maxScore": 15,
  "evidenceText": "CTR을 12% 높였습니다.",
  "evidenceSource": "coverLetter",
  "verified": true
}
```

### 4-5. Draft Generator Agent

파일:

```text
ai/app/services/cover_letter/draft_generator_agent.py
```

역할:

- 평가 결과와 RAG 근거를 바탕으로 자소서 수정 초안을 만든다.
- 원본 문항 수를 유지한다.
- 각 문항마다 소제목을 만든다.
- 마크다운 문법이나 괄호를 제거한다.

초안 생성 기준:

- 입력 문서에 없는 새 경험을 만들지 않는다.
- RAG 근거에 있는 경험을 중심으로 작성한다.
- `[문항 n] [소제목]` 형식을 지킨다.
- 역할, 행동, 결과, 직무 연결이 보이게 작성한다.

왜 필요한가:

- 피드백만 있으면 사용자가 어떻게 고쳐야 할지 막힐 수 있다.
- 수정 초안은 최종 제출본이 아니라, 사용자가 개선 방향을 이해하기 위한 학습용 결과물이다.

### 4-6. Draft Reviewer Agent

파일:

```text
ai/app/services/cover_letter/draft_reviewer_agent.py
```

역할:

- 생성된 초안을 다시 검사한다.
- 문항 수, 형식, JD 연결, 과장 여부를 확인한다.

검토 기준:

- 원본 문항 수와 같은가
- `[문항 n] [소제목]` 형식인가
- 소제목이 반드시 있는가
- 괄호나 마크다운이 없는가
- 입력 문서에 없는 경험을 만들지 않았는가
- JD와 연결되는가

왜 필요한가:

- 생성 AI는 그럴듯한 초안을 만들 수 있지만, 없는 내용을 섞을 위험이 있다.
- 그래서 초안도 한 번 더 검토한다.

## 5. LangGraph는 어디에 쓰이는가

파일:

```text
ai/app/services/cover_letter/cover_letter_graph.py
```

LangGraph는 agent 실행 순서를 고정하는 역할이다.

현재 graph:

```text
jd_analyzer
  -> rag_retriever
  -> evidence_extractor
  -> evaluator
  -> draft_generator
  -> draft_reviewer
  -> END
```

왜 필요한가:

- agent 순서가 섞이지 않게 한다.
- 평가 전에 반드시 RAG 검색을 하게 만든다.
- 초안을 만들기 전에 반드시 평가 결과를 거치게 만든다.
- 초안을 보여주기 전에 반드시 reviewer를 거치게 만든다.

현재 실제 `langgraph` 패키지를 설치했고, 스모크 테스트에서 `graphRuntime LANGGRAPH`를 확인했다.

## 6. 벡터 DB 기반 RAG는 어떻게 동작하는가

파일:

```text
ai/app/services/cover_letter/vector_rag_store.py
```

현재 구현은 SQLite 기반 경량 벡터 저장소다.

동작:

```text
1. JD, 자소서, 이력서, 포트폴리오를 chunk로 나눈다.
2. 각 chunk를 벡터로 변환한다.
3. SQLite DB에 chunk와 vector를 저장한다.
4. JD 키워드와 평가 항목 query로 검색한다.
5. cosine similarity가 높은 chunk를 평가 근거로 사용한다.
```

왜 SQLite인가:

- 로컬 개발 단계에서 별도 벡터 DB 서버 없이 바로 테스트할 수 있다.
- 메모리 사용량이 작다.
- 나중에 pgvector, Chroma, FAISS로 바꿀 수 있도록 코드가 분리되어 있다.

운영에서 권장:

- 로컬 개발: SQLite vector store
- 운영 배포: PostgreSQL pgvector 또는 Chroma

## 7. 점수는 어떻게 만들어지는가

점수 생성 흐름:

```text
1. RAG가 관련 근거를 찾는다.
2. Evaluator Agent가 항목별 점수를 만든다.
3. 각 항목은 evidenceText를 가진다.
4. 서버가 evidenceText가 실제 입력 문서에 있는지 확인한다.
5. 근거가 없으면 감점한다.
6. 항목별 점수를 합산해 totalScore를 만든다.
7. 검증된 항목 비율로 confidence를 만든다.
```

중요:

- `totalScore`는 합격 확률이 아니다.
- `confidence`는 점수 근거가 실제 문서에서 얼마나 확인됐는지 나타내는 값이다.

예시:

```json
{
  "totalScore": 82,
  "confidence": 0.9,
  "rubricScores": [
    {
      "category": "JD 반영도",
      "score": 21,
      "maxScore": 25,
      "verified": true
    }
  ]
}
```

## 8. 보안과 운영 기준

보안 기준:

- 프론트는 NestJS 공개 API만 호출한다.
- FastAPI는 내부 shared secret을 검사한다.
- 로그인 사용자 본인의 리포트만 조회/삭제할 수 있다.
- AI 응답은 그대로 믿지 않고 서버가 검증한다.
- JD에 없는 키워드는 평가 기준에서 제외한다.
- 사용자 문서에 없는 근거는 점수에서 감점한다.

운영 기준:

- OpenAI 호출이 실패해도 fallback 평가가 동작한다.
- LangGraph 미설치 환경에서도 fallback runner가 있어서 서버가 죽지 않는다.
- 현재는 LangGraph 설치 완료 상태라 실제 graph로 실행된다.
- RAG DB 경로는 `COVER_LETTER_RAG_DB_PATH`로 분리했다.
- RAG 검색 근거는 DB의 `rag_evidence_json`에 저장한다.

## 9. 사용자가 화면에서 보는 것

자소서 결과 화면과 마이페이지 상세에서 확인할 수 있는 항목:

- 총점
- JD 반영도
- 직무 적합도
- 근거 신뢰도
- 검증된 JD 키워드
- 문항별 점수
- 항목별 평가 기준
- RAG 검색 근거
- 강점
- 보완점
- 다음 액션
- 자소서 수정 초안

## 10. 예상 질문과 답변

질문: AI가 이상한 JD 키워드를 뽑으면 어떻게 하나?

답변: JD Analyzer Agent가 뽑은 키워드는 서버가 JD 원문에 실제로 있는지 다시 확인한다. JD에 없는 키워드는 `verifiedJdKeywords`에 들어가지 않고 평가 기준에서 제외된다.

질문: 점수는 AI가 주는 건가?

답변: 항목별 판단은 AI가 한다. 하지만 AI가 낸 근거 문장이 실제 입력 문서에 있는지 서버가 검증하고, 근거가 없으면 감점한다. 최종 점수는 검증 이후 합산된다.

질문: RAG는 정확히 어디에 쓰이나?

답변: JD 분석 결과를 query로 사용해서 자소서, 이력서, 포트폴리오에서 관련 근거 chunk를 찾는다. Evaluator Agent와 Draft Generator Agent는 이 근거를 우선 참고한다.

질문: LangGraph는 왜 필요한가?

답변: agent 실행 순서를 고정하기 위해 필요하다. JD 분석 없이 평가하거나, 근거 검색 없이 초안을 만드는 흐름을 막는다.

질문: 수정 초안이 없는 경험을 만들어내면?

답변: Draft Generator Agent는 RAG 근거에 없는 새 경험을 만들지 말라는 기준으로 생성한다. 이후 Draft Reviewer Agent가 문항 수, 형식, 과장 여부를 다시 검사한다.

질문: SQLite vector store는 실제 벡터 DB인가?

답변: 로컬 개발용 경량 벡터 저장소다. chunk와 vector를 DB에 저장하고 cosine similarity로 검색한다. 운영 단계에서는 같은 구조를 pgvector나 Chroma로 교체할 수 있다.

질문: confidence가 낮으면 무슨 뜻인가?

답변: 점수 근거가 실제 입력 문서에서 충분히 확인되지 않았다는 뜻이다. 즉, 점수 자체보다 추가 자료 입력이나 자소서 보강이 필요하다는 신호다.

## 11. 현재 완료된 것

- Agent 6개 분리 완료
- LangGraph 실행 연결 완료
- 벡터 DB 기반 RAG 연결 완료
- JD 키워드 원문 검증 완료
- 항목별 rubric 점수 추가 완료
- 근거 검증 및 감점 로직 완료
- confidence 계산 완료
- RAG 근거 응답 추가 완료
- RAG 근거 DB 저장 추가 완료
- 마이페이지/자소서 결과 화면 표시 완료
- 최종 보고서 작성 완료

## 12. 남은 고도화

현재 구조는 로컬 개발과 졸업작품 시연에 맞춘 안정형 구조다.

추후 고도화 방향:

- SQLite vector store를 pgvector로 교체
- OpenAI embedding 또는 한국어 embedding 모델 적용
- confidence가 낮으면 LangGraph conditional edge로 추가 자료 요청
- RAG chunk 암호화 저장
- 리포트별 근거 하이라이트 UI 강화
- 사용자별 장기 성장 추적 기능 추가

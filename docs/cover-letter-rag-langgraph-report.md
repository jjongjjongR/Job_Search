# 자소서 AI RAG + LangGraph 구조 보고서

## 1. 결론

자소서 AI는 이제 단일 프롬프트 호출 구조가 아니라 `벡터 DB 기반 RAG + LangGraph Agent Graph` 구조로 동작한다.

핵심은 다음과 같다.

- JD 분석 결과를 기준으로 검색 query를 만든다.
- 자기소개서, 이력서, 포트폴리오, JD를 chunk로 나눈다.
- chunk를 벡터화해서 SQLite 벡터 저장소에 저장한다.
- RAG Retriever Agent가 관련 근거 chunk를 검색한다.
- Evaluator Agent는 검색된 근거를 우선 사용해 항목별 점수를 낸다.
- 서버는 점수 근거가 실제 문서에 있는지 다시 검증한다.
- LangGraph는 이 흐름을 node 단위로 고정한다.

## 2. 전체 실행 흐름

```text
POST /ai/cover-letter/feedback
  -> NestJS 인증 사용자 확인
  -> jobAnalysisRequestId로 저장된 JD 조회
  -> FastAPI 내부 API 호출
  -> LangGraph 실행
      1. JD Analyzer Agent
      2. RAG Retriever Agent
      3. Evidence Extractor Agent
      4. Cover Letter Evaluator Agent
      5. Draft Generator Agent
      6. Draft Reviewer Agent
  -> 점수/근거/초안/신뢰도 반환
  -> cover_letter_reports 저장
```

프론트는 FastAPI를 직접 호출하지 않는다. 모든 요청은 NestJS 공개 API만 통과한다.

## 3. LangGraph 구성

파일: `ai/app/services/cover_letter/cover_letter_graph.py`

LangGraph node:

```text
jd_analyzer
  -> rag_retriever
  -> evidence_extractor
  -> evaluator
  -> draft_generator
  -> draft_reviewer
  -> END
```

각 node는 하나의 agent 함수를 실행한다.

LangGraph가 설치된 환경에서는 `StateGraph`를 사용한다. 설치되지 않은 로컬 환경에서도 서버가 죽지 않도록 같은 순서를 fallback runner가 실행한다.

왜 이렇게 했는가:
- 졸업작품 개발 중 의존성 문제로 서버가 죽는 일을 막기 위해서다.
- 배포/운영 환경에서 `langgraph`가 설치되면 실제 LangGraph graph로 실행된다.
- 로컬에서 아직 설치 전이어도 동일한 node 순서와 상태 구조로 동작한다.

## 4. Vector DB 기반 RAG

파일: `ai/app/services/cover_letter/vector_rag_store.py`

현재 구현:
- SQLite 테이블 `cover_letter_vectors`에 chunk와 vector를 저장한다.
- 각 chunk는 `collection_id`, `chunk_id`, `source`, `text`, `metadata_json`, `vector_json`을 가진다.
- 검색은 cosine similarity로 수행한다.

현재 vector 방식:
- OpenAI embedding API를 바로 붙이지 않고, 해시 기반 로컬 embedding을 사용한다.
- 이유는 OpenAI embedding 장애나 비용 문제 없이 로컬 테스트가 가능해야 하기 때문이다.
- 구조는 벡터 저장소로 분리되어 있어서 나중에 pgvector, Chroma, FAISS로 교체 가능하다.

저장 대상:
- JD
- 자기소개서
- 이력서
- 포트폴리오

검색 결과:

```json
{
  "source": "coverLetter",
  "text": "검색 품질 개선 프로젝트에서 Embedding 기반 랭킹 개선을 맡아 CTR을 12% 높였습니다.",
  "score": 0.4211
}
```

## 5. Agent별 역할

### 5-1. JD Analyzer Agent

파일: `jd_analyzer_agent.py`

역할:
- JD 원문에서 핵심 키워드를 추출한다.
- 직무명과 JD를 기준으로 직무 초점 키워드를 추출한다.
- 추출된 키워드가 실제 JD 원문에 있는지 검증한다.

기준:
- JD 원문에 없는 키워드는 평가 기준에서 제외한다.
- 예를 들어 JD에 `Java`가 없으면 `Java`는 `verifiedJdKeywords`에 들어가지 않는다.

출력:
- `jdKeywords`
- `jobFocusKeywords`
- `rejectedJdKeywords`

### 5-2. RAG Retriever Agent

파일: `rag_retriever_agent.py`

역할:
- JD 분석 결과를 query로 바꾼다.
- JD, 자기소개서, 이력서, 포트폴리오를 chunk로 나눠 벡터 저장소에 넣는다.
- 관련성이 높은 근거 chunk를 검색한다.

검색 query 기준:
- JD 핵심 키워드
- 직무 초점 키워드
- JD 반영도
- 직무 적합도
- 경험 구체성
- 성과/근거
- 문항 적합성
- 문장 완성도

출력:
- `collectionId`
- `chunkCount`
- `retrievedEvidence`

### 5-3. Evidence Extractor Agent

파일: `evidence_extractor_agent.py`

역할:
- 입력 문서를 정규화한다.
- 자소서를 문항 단위로 분리한다.
- RAG 검색 결과를 평가용 context에 포함한다.
- JD 키워드가 전체 문서에 얼마나 반영되었는지 계산한다.

출력:
- `documents`
- `questionInputs`
- `keywordHits`
- `rag.retrievedEvidence`

### 5-4. Cover Letter Evaluator Agent

파일: `cover_letter_evaluator_agent.py`

역할:
- RAG 검색 근거를 우선 참고해 자소서를 평가한다.
- AI가 항목별 점수와 근거 문장을 생성한다.
- 서버가 근거 문장이 실제 입력 문서에 있는지 검증한다.

평가 rubric:

| 항목 | 배점 |
| --- | --- |
| JD 반영도 | 25 |
| 직무 적합도 | 25 |
| 경험 구체성 | 20 |
| 성과/근거 | 15 |
| 문항 적합성 | 10 |
| 문장 완성도 | 5 |

검증 방식:
- AI는 `evidenceText`를 함께 반환한다.
- 서버는 `evidenceText`가 JD, 자소서, 이력서, 포트폴리오 중 해당 출처에 실제로 있는지 확인한다.
- 근거가 없으면 해당 항목 점수를 감점한다.
- 검증된 항목 비율로 `confidence`를 계산한다.

### 5-5. Draft Generator Agent

파일: `draft_generator_agent.py`

역할:
- 평가 결과와 RAG 근거를 바탕으로 수정 초안을 만든다.
- 원본 문항 수를 유지한다.
- 각 문항에 소제목을 붙인다.
- 마크다운, 괄호, 불필요한 장식 문법을 제거한다.

기준:
- RAG 근거에 없는 새 경험을 만들지 않는다.
- `[문항 n] [소제목]` 형식을 지킨다.
- 역할, 행동, 결과, 직무 연결이 보이게 작성한다.

### 5-6. Draft Reviewer Agent

파일: `draft_reviewer_agent.py`

역할:
- 생성 초안을 다시 검사한다.
- 문항 수, 형식, JD 연결, 과장 여부를 확인한다.

기준:
- 문항 수가 원본과 같아야 한다.
- `[문항 n] [소제목]` 형식이어야 한다.
- 소제목에 괄호가 없어야 한다.
- 입력 근거에 없는 새 경험을 만들면 안 된다.

## 6. 점수 신뢰도

점수는 AI가 단독으로 결정하지 않는다.

```text
AI 항목별 판단
  -> RAG 근거 우선 사용
  -> 서버 근거 검증
  -> 근거 없는 항목 감점
  -> 총점 재계산
  -> confidence 계산
```

응답 예시:

```json
{
  "totalScore": 82,
  "confidence": 0.9,
  "verifiedJdKeywords": ["RAG", "Embedding", "Reranker"],
  "rubricScores": [
    {
      "category": "JD 반영도",
      "score": 21,
      "maxScore": 25,
      "evidenceText": "Embedding 기반 랭킹 개선을 맡아 CTR을 12% 높였습니다.",
      "evidenceSource": "coverLetter",
      "verified": true
    }
  ],
  "ragEvidence": [
    {
      "source": "coverLetter",
      "text": "Embedding 기반 랭킹 개선을 맡아 CTR을 12% 높였습니다.",
      "score": 0.4211
    }
  ]
}
```

`confidence`는 합격 가능성 자체가 아니라, 점수 근거가 실제 입력 문서에서 얼마나 확인되었는지 나타내는 값이다.

## 7. 보안 관점

적용된 보안 기준:
- 프론트는 NestJS만 호출한다.
- FastAPI는 내부 shared secret 헤더를 검사한다.
- 리포트 조회/삭제는 로그인 사용자 본인 데이터만 가능하다.
- RAG collection은 요청 사용자와 JD 기준으로 분리한다.
- AI 응답은 그대로 신뢰하지 않고 서버 검증을 거친다.
- JD에 없는 키워드는 평가 기준에서 제외한다.
- 입력 문서에 없는 근거는 점수에서 감점한다.

운영 시 주의:
- 사용자 원문을 외부 로그에 남기지 않는다.
- 벡터 DB에는 원문 chunk가 들어가므로 운영 배포 시 암호화/접근 제어가 필요하다.
- 운영 환경에서는 SQLite 대신 RDS pgvector 또는 관리형 vector DB로 교체하는 것이 좋다.

## 8. 운영 관점

현재 운영 가능 지점:
- OpenAI 호출 실패 시에도 fallback 평가가 가능하다.
- LangGraph 미설치 환경에서도 fallback runner로 서버가 죽지 않는다.
- 벡터 DB 파일 경로는 `COVER_LETTER_RAG_DB_PATH`로 분리되어 있다.
- RAG 검색 근거는 `cover_letter_reports.rag_evidence_json`에 저장된다.

확인해야 할 지표:
- `confidence` 평균
- `verified=false` rubric 비율
- RAG 검색 chunk 수
- OpenAI 실패율
- 초안 reviewer 실패율

## 9. 예상 질문 답변

질문: AI가 JD에 없는 용어를 평가 기준으로 넣으면?

답변: JD Analyzer Agent가 추출한 키워드는 서버에서 JD 원문 포함 여부를 다시 확인한다. JD에 없는 용어는 `verifiedJdKeywords`에 들어가지 않고 평가 기준에서 제외된다.

질문: RAG는 어디에 쓰이나?

답변: JD 분석 결과를 query로 사용해 자소서, 이력서, 포트폴리오 chunk에서 관련 근거를 검색한다. Evaluator Agent와 Draft Generator Agent는 이 검색 근거를 우선 참고한다.

질문: 점수는 AI가 주나?

답변: 항목별 판단은 AI가 한다. 하지만 서버가 각 점수의 근거 문장이 실제 입력 문서에 있는지 검증하고, 근거가 없으면 감점한 뒤 최종 점수와 confidence를 계산한다.

질문: LangGraph를 왜 쓰나?

답변: agent 실행 순서를 코드로 고정하기 위해 쓴다. JD 분석, RAG 검색, 근거 추출, 평가, 초안 생성, 초안 검토가 임의 순서로 섞이지 않게 한다.

질문: SQLite면 진짜 vector DB인가?

답변: 현재는 로컬 개발용 경량 벡터 저장소다. chunk와 vector를 DB에 저장하고 cosine similarity로 검색한다. 구조는 vector DB 방식이며, 운영 단계에서는 pgvector나 Chroma로 교체하는 것이 맞다.

질문: 초안이 과장될 가능성은?

답변: Draft Generator Agent는 RAG 근거에 없는 새 경험을 만들지 말라는 기준으로 생성하고, Draft Reviewer Agent가 문항 수, 형식, JD 연결, 과장 여부를 다시 검사한다.

## 10. 남은 고도화

1. SQLite vector store를 PostgreSQL pgvector로 교체한다.
2. OpenAI embedding 또는 한국어 embedding 모델을 붙인다.
3. LangGraph conditional edge를 추가해 confidence가 낮으면 추가 자료 요청 또는 재평가로 보낸다.
4. 리포트 상세 화면에 rubric 근거와 RAG 근거를 표시한다.
5. 운영 환경에서 벡터 chunk 암호화와 자동 삭제 정책을 추가한다.

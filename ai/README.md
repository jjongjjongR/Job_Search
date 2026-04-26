# AI Server

이 디렉터리는 `Next.js -> NestJS -> FastAPI` 구조에서 FastAPI 내부 AI 서버를 담는다.

현재 코드 기준으로는 아래 기능이 구현되어 있다.

- 공고 분석 내부 API
- 자소서 피드백 내부 API
- 면접 세션 시작/답변/종료 내부 API
- 자소서 RAG + LangGraph 흐름
- 면접 질문 계획, 답변 평가, STT fallback, Vision 보조 평가 규칙
- Redis temp state helper

## 실행 방법

1. 가상환경 생성 후 활성화
2. 의존성 설치
3. `.env.example`을 참고해 `.env` 작성
4. 아래 명령으로 실행

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## 테스트

```bash
pytest
```

## 현재 포함된 라우트

- `GET /health`
- `POST /internal/jobs/analyze`
- `POST /internal/cover-letter/feedback`
- `POST /internal/interview/start`
- `POST /internal/interview/answer`
- `POST /internal/interview/finish`

# AI Server

이 디렉터리는 `Next.js -> NestJS -> FastAPI` 구조에서 FastAPI 내부 AI 서버 뼈대다.
현재 단계에서는 실제 LLM/STT/Vision 로직 없이 더미 응답으로 동작한다.

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

## 현재 더미 구현인 부분

- 공고 분석
- 자소서 피드백 생성
- 면접 세션 시작
- 면접 답변 처리
- 면접 세션 종료
- STT / Vision / TTS 서비스
- storage / temp state / llm adapter

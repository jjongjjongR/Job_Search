# Frontend

Next.js 사용자 화면이다. 사용자는 이 앱에서 로그인, 게시판/자료실 이용, 공고 분석, 자기소개서 피드백, AI 면접 세션 진행, 결과 재조회를 수행한다.

## 역할

- NestJS 공개 API만 호출
- JWT access token 기반 인증 상태 유지
- 공고 분석 입력/결과 표시
- 자소서 피드백 입력/리포트 표시
- 면접 세션 시작, 답변 업로드, 텍스트 fallback, 최종 리포트 표시
- 마이페이지에서 자소서 리포트 재조회/삭제

## 실행

```bash
pnpm install
pnpm dev
```

기본 포트는 `3000`이다.

## 환경변수

- `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001`
- `NEXTAUTH_URL=http://localhost:3000`
- `NEXTAUTH_SECRET=change-me`

## 주요 화면

- `/`
- `/login`
- `/signup`
- `/board`
- `/dataroom`
- `/ai_cover_letter`
- `/ai_interview`
- `/mypage`

## 빌드 검증

```bash
npm run build
```

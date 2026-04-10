# Storage Architecture

## 1. 목적

이 문서는 로컬 파일 저장으로 개발하되, 이후 S3로 교체하기 쉽게 저장 계층을 분리한 현재 구조를 설명한다.

## 2. 현재 구조

- Port:
  - `backend/src/storage/ports/storage.port.ts`
- Local Adapter:
  - `backend/src/storage/adapters/local-storage.adapter.ts`
- Module:
  - `backend/src/storage/storage.module.ts`

## 3. 저장 구분

- `durable`
  - 장기 보관 대상
  - 예: 자료실 파일, 사용자 문서, 최종 리포트 산출물
- `temp`
  - 단기 보관 대상
  - 예: 면접 업로드 직후 처리용 파일, STT/Vision 전처리용 파일

현재 목적값 기준:

- durable 목적
  - `user_document`
  - `dataroom_item`
  - `report_artifact`
- temp 목적
  - `interview_answer_upload`
  - `raw_transcript`
  - `raw_vision_metrics`

## 4. key 규칙

- 로컬 저장 key는 `{bucket}/{purpose}/{timestamp}-{sanitized-file-name}` 형식을 사용한다.
- 예:
  - `durable/user_document/1760100000000-resume.txt`
  - `durable/dataroom_item/1760100000001-guide.pdf`
  - `temp/interview_answer_upload/1760100000002-answer-video.mp4`
  - `temp/raw_transcript/1760100000003-turn-1.json`

## 5. protected download 원칙

- 외부 사용자는 storage 경로를 직접 접근하지 않는다.
- 인증된 요청만 NestJS controller를 통해 다운로드한다.
- 현재 `files` 다운로드는 storage key를 해석한 뒤 서버가 파일을 전달하는 방식이다.

## 6. 장기 저장 금지 대상

- raw video
- raw frame image

위 항목은 `temp` 목적에만 둘 수 있도록 설계해야 한다.
현재 구조에서는 영상 임시 업로드는 `interview_answer_upload`, transcript 원본은 `raw_transcript`, vision 원본은 `raw_vision_metrics` 목적을 사용한다.
즉, raw video나 raw frame image가 durable 목적값으로 저장되지는 않도록 입력 단계에서 목적을 분리했다.

## 7. 이후 S3 전환 방향

- `StoragePort`는 그대로 유지한다.
- `LocalStorageAdapter` 대신 `S3StorageAdapter`를 추가한다.
- controller/service는 `StoragePort`만 사용하므로 호출부 변경을 최소화할 수 있다.

## 8. 현재 적용 범위

- 자료실 업로드는 `dataroom_item` 목적값으로 저장한다.
- 다운로드는 기존처럼 인증 후 서버 경유 방식으로 유지한다.
- 면접 temp 파일 저장은 다음 단계 기능 구현 시 `interview_answer_upload`, `raw_transcript`, `raw_vision_metrics` 목적값으로 연결하면 된다.

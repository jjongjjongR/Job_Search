import mimetypes
import re
from pathlib import Path

import httpx

from app.core.config import settings
from app.schemas.common import InterviewDecisionType
from app.schemas.interview import InterviewAnswerRequest

OPENAI_STT_TIMEOUT_SECONDS = 60.0


def _contains_core_noun(text: str) -> bool:
    tokens = re.findall(r"[A-Za-z][A-Za-z0-9.+#-]{1,}|[가-힣]{2,}", text)
    return len(tokens) >= 3


def _sentence_count(text: str) -> int:
    return len([part for part in re.split(r"[.!?\n]+", text) if part.strip()])


# 2026.04.25 신규: 실제 업로드된 임시 영상 storage key를 로컬 파일 경로로 해석
def _resolve_storage_file_path(storage_key: str) -> Path | None:
    cleaned_key = storage_key.strip().lstrip("/").replace("\\", "/")
    if not cleaned_key or ".." in cleaned_key.split("/"):
        return None
    return (Path(settings.BACKEND_STORAGE_ROOT) / cleaned_key).resolve()


# 2026.04.25 신규: answerVideoStorageKey가 있으면 OpenAI STT로 실제 전사를 시도
def _transcribe_with_openai(storage_key: str) -> str | None:
    if not settings.OPENAI_API_KEY:
        return None

    file_path = _resolve_storage_file_path(storage_key)
    if not file_path or not file_path.exists() or not file_path.is_file():
        return None

    mime_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"

    try:
        with file_path.open("rb") as audio_file, httpx.Client(
            timeout=OPENAI_STT_TIMEOUT_SECONDS
        ) as client:
            response = client.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                data={
                    "model": settings.OPENAI_STT_MODEL,
                    "response_format": "text",
                },
                files={"file": (file_path.name, audio_file, mime_type)},
            )
            response.raise_for_status()
        transcript = response.text.strip()
        return transcript or None
    except Exception:
        return None


# 2026.04.21 신규: 11단계 규칙에 맞춰 STT 실패 여부와 다음 조치를 판단
def evaluate_stt_fallback(
    payload: InterviewAnswerRequest,
    current_retry_count: int,
) -> dict[str, object]:
    if payload.answerType == "TEXT":
        cleaned_text = (payload.answerText or "").strip()
        return {
            "accepted": True,
            "answerFullText": cleaned_text,
            "source": "TEXT",
            "retryCount": current_retry_count,
            "decisionType": None,
            "message": None,
            "failureReason": None,
        }

    transcript = (
        (payload.transcriptHint or "").strip()
        or (
            _transcribe_with_openai(payload.answerVideoStorageKey)
            if payload.answerVideoStorageKey
            else None
        )
        or (payload.answerText or "").strip()
    )
    failure_reasons: list[str] = []

    if payload.videoDurationSeconds is not None and payload.videoDurationSeconds <= 3:
        failure_reasons.append("영상 길이가 너무 짧아 답변을 충분히 인식하기 어렵습니다.")
    if payload.hasAudio is False:
        failure_reasons.append("음성이 감지되지 않아 전사를 진행할 수 없습니다.")
    if payload.severeNoise is True:
        failure_reasons.append("잡음이 심해 전사 정확도가 크게 떨어집니다.")
    if transcript and _sentence_count(transcript) <= 1 and not _contains_core_noun(transcript):
        failure_reasons.append("전사 결과가 너무 짧고 핵심 내용이 부족합니다.")
    if not transcript:
        failure_reasons.append("전사 텍스트를 확보하지 못했습니다.")

    if not failure_reasons:
        return {
            "accepted": True,
            "answerFullText": transcript,
            "source": "STT",
            "retryCount": current_retry_count,
            "decisionType": None,
            "message": None,
            "failureReason": None,
        }

    next_retry_count = current_retry_count + 1
    if next_retry_count >= 2:
        return {
            "accepted": False,
            "answerFullText": "",
            "source": "STT",
            "retryCount": next_retry_count,
            "decisionType": InterviewDecisionType.REQUEST_TEXT,
            "message": "영상 답변 인식이 두 번 연속 실패해 텍스트 답변으로 전환합니다.",
            "failureReason": failure_reasons[0],
        }

    return {
        "accepted": False,
        "answerFullText": "",
        "source": "STT",
        "retryCount": next_retry_count,
        "decisionType": InterviewDecisionType.RETRY_UPLOAD,
        "message": "영상 답변 인식이 불안정해 같은 턴에서 다시 업로드해 주세요.",
        "failureReason": failure_reasons[0],
    }

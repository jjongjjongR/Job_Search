from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from app.core.config import settings


class RedisInterviewStateStore:
    """
    2026.04.10 신규
    면접 세션 진행 중 임시 상태를 Redis에 저장하는 helper.
    redis 패키지가 설치되지 않은 환경에서는 runtime에만 ImportError가 발생한다.
    """

    def __init__(self, redis_url: str, default_ttl_seconds: int) -> None:
        self.redis_url = redis_url
        self.default_ttl_seconds = default_ttl_seconds

    async def save_session_state(self, session_id: str, payload: dict[str, Any]) -> None:
        await self._set_json(self._session_state_key(session_id), payload)

    async def get_session_state(self, session_id: str) -> dict[str, Any] | None:
        return await self._get_json(self._session_state_key(session_id))

    async def delete_session_state(self, session_id: str) -> None:
        await self._delete(self._session_state_key(session_id))

    async def save_raw_transcript(
        self,
        session_id: str,
        turn_id: str,
        payload: dict[str, Any],
    ) -> None:
        await self._set_json(self._raw_transcript_key(session_id, turn_id), payload)

    async def save_raw_vision_metrics(
        self,
        session_id: str,
        turn_id: str,
        payload: dict[str, Any],
    ) -> None:
        await self._set_json(self._raw_vision_key(session_id, turn_id), payload)

    async def save_hidden_score(
        self,
        session_id: str,
        turn_id: str,
        payload: dict[str, Any],
    ) -> None:
        await self._set_json(self._hidden_score_key(session_id, turn_id), payload)

    async def save_stt_retry_count(
        self,
        session_id: str,
        turn_id: str,
        retry_count: int,
    ) -> None:
        await self._set_json(
            self._stt_retry_key(session_id, turn_id),
            {"retryCount": retry_count},
        )

    async def get_stt_retry_count(self, session_id: str, turn_id: str) -> int:
        payload = await self._get_json(self._stt_retry_key(session_id, turn_id))
        if not payload:
            return 0
        return int(payload.get("retryCount", 0))

    async def list_hidden_scores(self, session_id: str) -> list[dict[str, Any]]:
        client = await self._client()
        keys = sorted(await client.keys(f"interview:session:{session_id}:hidden-score:*"))
        payloads: list[dict[str, Any]] = []
        for key in keys:
            value = await client.get(key)
            if value:
                payloads.append(json.loads(value))
        await client.aclose()
        return payloads

    async def refresh_session_ttl(self, session_id: str) -> None:
        client = await self._client()
        keys = [
            self._session_state_key(session_id),
            self._cleanup_key(session_id),
        ]
        artifact_keys = await self._artifact_keys(client, session_id)
        for key in [*keys, *artifact_keys]:
            await client.expire(key, self.default_ttl_seconds)
        await client.aclose()

    async def schedule_cleanup(self, session_id: str, ttl_seconds: int = 600) -> None:
        deadline = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)
        await self._set_json(
            self._cleanup_key(session_id),
            {
                "cleanupDeadline": deadline.isoformat(),
                "deleteAfterSeconds": ttl_seconds,
            },
            # 2026-04-29 수정: cleanup key가 삭제 시점 전에 만료되지 않도록 여유 TTL을 둔다
            ttl_seconds=ttl_seconds + self.default_ttl_seconds,
        )

    async def delete_session_artifacts(self, session_id: str) -> None:
        client = await self._client()
        session_state = await self._get_json_with_client(
            client,
            self._session_state_key(session_id),
        )
        # 2026-04-29 신규: 기준사항에 맞춰 private temp storage의 임시 답변 영상 파일도 함께 삭제
        self._delete_temp_video_files(session_state)
        keys = [
            self._session_state_key(session_id),
            self._cleanup_key(session_id),
        ]
        artifact_keys = await self._artifact_keys(client, session_id)
        if artifact_keys or keys:
            await client.delete(
                *keys,
                *artifact_keys,
            )
        await client.aclose()

    async def list_due_cleanup_session_ids(
        self,
        now: datetime | None = None,
    ) -> list[str]:
        client = await self._client()
        current_time = now or datetime.now(timezone.utc)
        session_ids: list[str] = []

        try:
            async for key in client.scan_iter(match="interview:session:*:cleanup"):
                payload_raw = await client.get(key)
                if not payload_raw:
                    continue

                try:
                    payload = json.loads(payload_raw)
                    deadline_text = str(payload.get("cleanupDeadline") or "").strip()
                    deadline = datetime.fromisoformat(deadline_text)
                    if deadline.tzinfo is None:
                        deadline = deadline.replace(tzinfo=timezone.utc)
                except (TypeError, ValueError, json.JSONDecodeError):
                    deadline = current_time

                if deadline <= current_time:
                    session_id = self._session_id_from_cleanup_key(key)
                    if session_id:
                        session_ids.append(session_id)
        finally:
            await client.aclose()

        return sorted(set(session_ids))

    async def cleanup_due_sessions(
        self,
        now: datetime | None = None,
    ) -> list[str]:
        session_ids = await self.list_due_cleanup_session_ids(now=now)
        for session_id in session_ids:
            await self.delete_session_artifacts(session_id)
        return session_ids

    async def _set_json(
        self,
        key: str,
        payload: dict[str, Any],
        ttl_seconds: int | None = None,
    ) -> None:
        client = await self._client()
        await client.set(key, json.dumps(payload), ex=ttl_seconds or self.default_ttl_seconds)
        await client.aclose()

    async def _get_json(self, key: str) -> dict[str, Any] | None:
        client = await self._client()
        value = await client.get(key)
        await client.aclose()
        if not value:
            return None
        return json.loads(value)

    async def _get_json_with_client(self, client, key: str) -> dict[str, Any] | None:
        value = await client.get(key)
        if not value:
            return None
        return json.loads(value)

    async def _delete(self, key: str) -> None:
        client = await self._client()
        await client.delete(key)
        await client.aclose()

    async def _client(self):
        from redis.asyncio import from_url

        return from_url(self.redis_url, decode_responses=True)

    async def _artifact_keys(self, client, session_id: str) -> list[str]:
        patterns = [
            f"interview:session:{session_id}:transcript:*",
            f"interview:session:{session_id}:raw-transcript:*",
            f"interview:session:{session_id}:vision:*",
            f"interview:session:{session_id}:raw-vision:*",
            f"interview:session:{session_id}:hidden-score:*",
            f"interview:session:{session_id}:stt-retry:*",
        ]
        keys: list[str] = []
        for pattern in patterns:
            keys.extend(await client.keys(pattern))
        return keys

    def _delete_temp_video_files(self, session_state: dict[str, Any] | None) -> None:
        if not session_state:
            return

        storage_root = Path(settings.BACKEND_STORAGE_ROOT).resolve()
        for storage_key in session_state.get("tempVideoStorageKeys", []):
            cleaned_key = str(storage_key).strip().lstrip("/").replace("\\", "/")
            if (
                not cleaned_key
                or ".." in cleaned_key.split("/")
                or not cleaned_key.startswith("temp/interview_answer_upload/")
            ):
                continue

            file_path = (storage_root / cleaned_key).resolve()
            if storage_root not in file_path.parents:
                continue

            file_path.unlink(missing_ok=True)

    def _session_state_key(self, session_id: str) -> str:
        return f"interview:session:{session_id}:state"

    def _raw_transcript_key(self, session_id: str, turn_id: str) -> str:
        return f"interview:session:{session_id}:transcript:{turn_id}"

    def _raw_vision_key(self, session_id: str, turn_id: str) -> str:
        return f"interview:session:{session_id}:vision:{turn_id}"

    def _hidden_score_key(self, session_id: str, turn_id: str) -> str:
        return f"interview:session:{session_id}:hidden-score:{turn_id}"

    def _stt_retry_key(self, session_id: str, turn_id: str) -> str:
        return f"interview:session:{session_id}:stt-retry:{turn_id}"

    def _cleanup_key(self, session_id: str) -> str:
        return f"interview:session:{session_id}:cleanup"

    def _session_id_from_cleanup_key(self, key: str) -> str | None:
        prefix = "interview:session:"
        suffix = ":cleanup"
        if not key.startswith(prefix) or not key.endswith(suffix):
            return None
        return key[len(prefix) : -len(suffix)] or None


redis_interview_state_store = RedisInterviewStateStore(
    redis_url=settings.REDIS_URL,
    default_ttl_seconds=settings.REDIS_DEFAULT_TTL_SECONDS,
)

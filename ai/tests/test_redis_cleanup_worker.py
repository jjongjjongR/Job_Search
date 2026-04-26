from datetime import datetime, timedelta, timezone

import pytest

from app.adapters.redis_state_store import RedisInterviewStateStore
from app.services.interview.cleanup_service import cleanup_due_interview_sessions


def test_session_id_is_parsed_from_cleanup_key():
    store = RedisInterviewStateStore("redis://localhost:6379/0", 600)

    assert (
        store._session_id_from_cleanup_key("interview:session:ivs-123:cleanup")
        == "ivs-123"
    )
    assert store._session_id_from_cleanup_key("interview:session:ivs-123:state") is None


@pytest.mark.anyio
async def test_cleanup_due_sessions_deletes_only_due_sessions(monkeypatch):
    now = datetime.now(timezone.utc)
    cleanup_payloads = {
        "interview:session:ivs-due:cleanup": {
            "cleanupDeadline": (now - timedelta(seconds=1)).isoformat()
        },
        "interview:session:ivs-later:cleanup": {
            "cleanupDeadline": (now + timedelta(seconds=60)).isoformat()
        },
    }
    deleted_session_ids: list[str] = []

    class FakeClient:
        async def scan_iter(self, match: str):
            for key in cleanup_payloads:
                yield key

        async def get(self, key: str):
            payload = cleanup_payloads.get(key)
            if payload is None:
                return None
            import json

            return json.dumps(payload)

        async def aclose(self):
            return None

    store = RedisInterviewStateStore("redis://localhost:6379/0", 600)

    async def fake_client():
        return FakeClient()

    async def fake_delete_session_artifacts(session_id: str):
        deleted_session_ids.append(session_id)

    monkeypatch.setattr(store, "_client", fake_client)
    monkeypatch.setattr(store, "delete_session_artifacts", fake_delete_session_artifacts)

    cleaned = await store.cleanup_due_sessions(now=now)

    assert cleaned == ["ivs-due"]
    assert deleted_session_ids == ["ivs-due"]


@pytest.mark.anyio
async def test_cleanup_service_delegates_to_store(monkeypatch):
    expected = ["ivs-cleanup-1", "ivs-cleanup-2"]

    async def fake_cleanup_due_sessions():
        return expected

    from app.services.interview import cleanup_service

    monkeypatch.setattr(
        cleanup_service.redis_interview_state_store,
        "cleanup_due_sessions",
        fake_cleanup_due_sessions,
    )

    assert await cleanup_due_interview_sessions() == expected

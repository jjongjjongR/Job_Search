from __future__ import annotations

import asyncio
import logging
from contextlib import suppress

from app.adapters.redis_state_store import redis_interview_state_store
from app.core.config import settings


logger = logging.getLogger(__name__)


async def cleanup_due_interview_sessions() -> list[str]:
    return await redis_interview_state_store.cleanup_due_sessions()


async def run_cleanup_worker(stop_event: asyncio.Event) -> None:
    interval_seconds = max(5, settings.REDIS_CLEANUP_INTERVAL_SECONDS)

    while not stop_event.is_set():
        try:
            cleaned_session_ids = await cleanup_due_interview_sessions()
            if cleaned_session_ids:
                logger.info(
                    "Redis interview cleanup removed %s session(s): %s",
                    len(cleaned_session_ids),
                    ", ".join(cleaned_session_ids),
                )
        except Exception:
            logger.exception("Redis interview cleanup worker failed")

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=interval_seconds)
        except asyncio.TimeoutError:
            continue


async def stop_cleanup_worker(task: asyncio.Task[None], stop_event: asyncio.Event) -> None:
    stop_event.set()
    task.cancel()
    with suppress(asyncio.CancelledError):
        await task

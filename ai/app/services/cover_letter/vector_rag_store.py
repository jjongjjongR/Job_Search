from __future__ import annotations

import hashlib
import json
import math
import os
import re
import sqlite3
from dataclasses import dataclass
from pathlib import Path

from app.core.config import settings

VECTOR_DIMENSION = 256


@dataclass
class RagChunk:
    chunk_id: str
    source: str
    text: str
    metadata: dict[str, object]
    score: float = 0.0


def _tokenize(text: str) -> list[str]:
    return [
        token.lower()
        for token in re.findall(r"[A-Za-z][A-Za-z0-9.+#-]{1,}|[가-힣]{2,}", text)
    ]


def _hash_token(token: str) -> int:
    return int(hashlib.sha256(token.encode("utf-8")).hexdigest(), 16)


# 2026-04-23 신규: 외부 임베딩 장애 시에도 동작하는 해시 기반 로컬 embedding
def embed_text(text: str) -> list[float]:
    vector = [0.0] * VECTOR_DIMENSION
    for token in _tokenize(text):
        index = _hash_token(token) % VECTOR_DIMENSION
        vector[index] += 1.0

    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0:
        return vector
    return [value / norm for value in vector]


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right:
        return 0.0
    return sum(left_value * right_value for left_value, right_value in zip(left, right))


def chunk_text(source: str, text: str, max_chars: int = 420) -> list[RagChunk]:
    cleaned = re.sub(r"\s+", " ", text).strip()
    if not cleaned:
        return []

    sentences = [
        sentence.strip()
        for sentence in re.split(r"(?<=[.!?。])\s+|\n+", text)
        if sentence.strip()
    ]
    if not sentences:
        sentences = [cleaned]

    chunks: list[RagChunk] = []
    buffer = ""
    for sentence in sentences:
        candidate = f"{buffer} {sentence}".strip()
        if len(candidate) <= max_chars:
            buffer = candidate
            continue

        if buffer:
            chunks.append(_build_chunk(source, buffer, len(chunks)))
        buffer = sentence

    if buffer:
        chunks.append(_build_chunk(source, buffer, len(chunks)))
    return chunks


def _build_chunk(source: str, text: str, index: int) -> RagChunk:
    chunk_key = f"{source}:{index}:{text[:80]}"
    chunk_id = hashlib.sha256(chunk_key.encode("utf-8")).hexdigest()[:24]
    return RagChunk(
        chunk_id=chunk_id,
        source=source,
        text=text.strip(),
        metadata={"index": index, "source": source},
    )


class CoverLetterVectorRagStore:
    """
    2026-04-23 신규
    자소서 AI용 경량 벡터 저장소.
    로컬 개발 단계에서는 SQLite에 벡터를 저장하고 cosine similarity로 검색한다.
    나중에 pgvector/Chroma로 바꿔도 agent 인터페이스는 유지할 수 있게 분리한다.
    """

    def __init__(self, db_path: str) -> None:
        self.db_path = Path(db_path)
        if not self.db_path.is_absolute():
            self.db_path = Path.cwd() / self.db_path

    def upsert_chunks(self, collection_id: str, chunks: list[RagChunk]) -> None:
        self._ensure_database()
        with sqlite3.connect(self.db_path) as connection:
            connection.executemany(
                """
                INSERT OR REPLACE INTO cover_letter_vectors
                (collection_id, chunk_id, source, text, metadata_json, vector_json)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        collection_id,
                        chunk.chunk_id,
                        chunk.source,
                        chunk.text,
                        json.dumps(chunk.metadata, ensure_ascii=False),
                        json.dumps(embed_text(chunk.text)),
                    )
                    for chunk in chunks
                ],
            )

    def search(self, collection_id: str, query: str, limit: int = 5) -> list[RagChunk]:
        self._ensure_database()
        query_vector = embed_text(query)
        with sqlite3.connect(self.db_path) as connection:
            rows = connection.execute(
                """
                SELECT chunk_id, source, text, metadata_json, vector_json
                FROM cover_letter_vectors
                WHERE collection_id = ?
                """,
                (collection_id,),
            ).fetchall()

        scored_chunks: list[RagChunk] = []
        for chunk_id, source, text, metadata_json, vector_json in rows:
            score = cosine_similarity(query_vector, json.loads(vector_json))
            scored_chunks.append(
                RagChunk(
                    chunk_id=chunk_id,
                    source=source,
                    text=text,
                    metadata=json.loads(metadata_json),
                    score=round(score, 4),
                )
            )

        scored_chunks.sort(key=lambda chunk: chunk.score, reverse=True)
        return [chunk for chunk in scored_chunks[:limit] if chunk.score > 0]

    def delete_collection(self, collection_id: str) -> None:
        self._ensure_database()
        with sqlite3.connect(self.db_path) as connection:
            connection.execute(
                "DELETE FROM cover_letter_vectors WHERE collection_id = ?",
                (collection_id,),
            )

    def _ensure_database(self) -> None:
        os.makedirs(self.db_path.parent, exist_ok=True)
        with sqlite3.connect(self.db_path) as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS cover_letter_vectors (
                    collection_id TEXT NOT NULL,
                    chunk_id TEXT NOT NULL,
                    source TEXT NOT NULL,
                    text TEXT NOT NULL,
                    metadata_json TEXT NOT NULL,
                    vector_json TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (collection_id, chunk_id)
                )
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_cover_letter_vectors_collection
                ON cover_letter_vectors(collection_id)
                """
            )


cover_letter_vector_rag_store = CoverLetterVectorRagStore(
    settings.COVER_LETTER_RAG_DB_PATH
)

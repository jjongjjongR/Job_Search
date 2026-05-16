from __future__ import annotations

import hashlib
import math
import os
import re
from dataclasses import dataclass
from pathlib import Path

import chromadb
from chromadb.config import Settings as ChromaSettings

from app.core.config import settings

VECTOR_DIMENSION = 256
# 2026-05-07 수정: JD 근거가 너무 크게 뭉치지 않도록 Chroma 검색용 chunk 크기를 조정
CHUNK_MAX_CHARS = 420
# 2026-05-07 수정: 문맥은 유지하되 다음 chunk가 과하게 섞이지 않도록 overlap을 조정
CHUNK_OVERLAP_CHARS = 100


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
        # 2026-05-07 수정: 5G/6G처럼 숫자로 시작하는 기술어도 RAG 검색 token으로 사용
        for token in re.findall(
            r"[A-Za-z][A-Za-z0-9.+#/-]{1,}|\d+[A-Za-z][A-Za-z0-9.+#/-]*|[가-힣]{2,}",
            text,
        )
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


def chunk_text(source: str, text: str, max_chars: int = CHUNK_MAX_CHARS) -> list[RagChunk]:
    cleaned = re.sub(r"\s+", " ", text).strip()
    if not cleaned:
        return []

    sentences = [
        sentence.strip()
        # 2026-05-07 수정: 자소서는 문항 단위 검색이 중요하므로 [문항 n] 앞에서도 chunk 후보를 분리
        for sentence in re.split(r"(?<=[.!?。])\s+|\n+|(?=\[문항\s*\d+\])|(?=[■·\-]\s*)", text)
        if sentence.strip()
    ]
    if not sentences:
        sentences = [cleaned]

    chunks: list[RagChunk] = []
    buffer = ""
    for sentence in sentences:
        if buffer and re.match(r"^\[문항\s*\d+\]", sentence):
            # 2026-05-07 신규: 자소서 문항이 바뀌면 길이가 짧아도 별도 근거 chunk로 분리
            chunks.append(_build_chunk(source, buffer, len(chunks)))
            buffer = ""

        while len(sentence) > max_chars:
            split_at = sentence.rfind(" ", 0, max_chars)
            if split_at < max_chars // 2:
                split_at = max_chars
            segment = sentence[:split_at].strip()
            sentence = sentence[split_at:].strip()
            if buffer:
                chunks.append(_build_chunk(source, buffer, len(chunks)))
                # 2026-05-07 수정: 긴 자소서 문단도 Chroma 검색 가능한 크기로 나누고 단어 경계 overlap을 유지
                buffer = _build_overlap_text(buffer)
            candidate = f"{buffer} {segment}".strip()
            chunks.append(_build_chunk(source, candidate, len(chunks)))
            buffer = _build_overlap_text(candidate)

        if not sentence:
            continue

        candidate = f"{buffer} {sentence}".strip()
        if len(candidate) <= max_chars:
            buffer = candidate
            continue

        if buffer:
            chunks.append(_build_chunk(source, buffer, len(chunks)))
        # 2026-05-07 수정: chunk 시작이 단어 중간에서 끊기지 않도록 overlap을 단어 경계로 정리
        overlap = _build_overlap_text(buffer)
        buffer = f"{overlap} {sentence}".strip() if overlap else sentence

    if buffer:
        chunks.append(_build_chunk(source, buffer, len(chunks)))
    return chunks


def _build_overlap_text(text: str) -> str:
    overlap = text[-CHUNK_OVERLAP_CHARS:].strip()
    if not overlap:
        return ""
    first_space = overlap.find(" ")
    if first_space <= 0:
        return overlap
    return overlap[first_space + 1 :].strip()


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
    2026-05-07 수정
    자소서/면접 AI용 ChromaDB 기반 벡터 저장소.
    로컬 개발 단계에서는 PersistentClient로 디스크에 저장하고, 운영 단계에서는
    같은 인터페이스를 유지한 채 Chroma 서버나 다른 vector DB로 교체할 수 있다.
    """

    def __init__(self, db_path: str) -> None:
        self.db_path = Path(db_path)
        if not self.db_path.is_absolute():
            self.db_path = Path.cwd() / self.db_path
        os.makedirs(self.db_path, exist_ok=True)
        self.client = chromadb.PersistentClient(
            path=str(self.db_path),
            settings=ChromaSettings(anonymized_telemetry=False),
        )

    def upsert_chunks(self, collection_id: str, chunks: list[RagChunk]) -> None:
        if not chunks:
            return

        collection = self.client.get_or_create_collection(
            name=self._collection_name(collection_id),
            metadata={"hnsw:space": "cosine"},
        )
        collection.upsert(
            ids=[chunk.chunk_id for chunk in chunks],
            documents=[chunk.text for chunk in chunks],
            embeddings=[embed_text(chunk.text) for chunk in chunks],
            metadatas=[
                {
                    "source": chunk.source,
                    "index": int(chunk.metadata.get("index", 0)),
                }
                for chunk in chunks
            ],
        )

    def search(self, collection_id: str, query: str, limit: int = 5) -> list[RagChunk]:
        if not query.strip():
            return []

        try:
            collection = self.client.get_collection(name=self._collection_name(collection_id))
        except Exception:
            return []

        # 2026-05-07 신규: 저장된 chunk 수보다 많이 요청할 때 Chroma 경고가 나지 않도록 검색 개수를 제한
        result_limit = min(limit, collection.count())
        if result_limit <= 0:
            return []

        result = collection.query(
            query_embeddings=[embed_text(query)],
            n_results=result_limit,
            include=["documents", "metadatas", "distances"],
        )
        ids = result.get("ids", [[]])[0]
        documents = result.get("documents", [[]])[0]
        metadatas = result.get("metadatas", [[]])[0]
        distances = result.get("distances", [[]])[0]

        chunks: list[RagChunk] = []
        for chunk_id, text, metadata, distance in zip(ids, documents, metadatas, distances):
            score = max(0.0, 1.0 - float(distance))
            if score <= 0:
                continue
            source = str((metadata or {}).get("source") or "unknown")
            chunks.append(
                RagChunk(
                    chunk_id=chunk_id,
                    source=source,
                    text=text,
                    metadata=dict(metadata or {}),
                    score=round(score, 4),
                )
            )
        return chunks

    def delete_collection(self, collection_id: str) -> None:
        try:
            self.client.delete_collection(name=self._collection_name(collection_id))
        except Exception:
            return

    def _collection_name(self, collection_id: str) -> str:
        safe_id = re.sub(r"[^A-Za-z0-9_-]", "_", collection_id).strip("_")
        if len(safe_id) < 3:
            safe_id = hashlib.sha256(collection_id.encode("utf-8")).hexdigest()[:12]
        return f"rag_{safe_id}"[:63]


cover_letter_vector_rag_store = CoverLetterVectorRagStore(
    settings.COVER_LETTER_RAG_DB_PATH
)

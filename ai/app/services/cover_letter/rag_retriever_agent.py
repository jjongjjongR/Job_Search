import hashlib

from app.schemas.cover_letter import CoverLetterFeedbackRequest
from app.services.cover_letter.shared import normalize_documents
from app.services.cover_letter.vector_rag_store import (
    RagChunk,
    chunk_text,
    cover_letter_vector_rag_store,
)

RAG_QUERY_TEMPLATES = [
    "JD 필수 요구 역량과 직접 연결되는 지원자 경험",
    "직무 적합성을 보여주는 기술 경험과 역할",
    "구체적인 문제 해결 과정과 선택 이유",
    "성과 수치 결과 근거 개선 향상 달성",
    "문항 요구에 직접 답하는 핵심 경험",
    "문장 완성도와 논리 흐름을 보여주는 표현",
]


def _collection_id(payload: CoverLetterFeedbackRequest) -> str:
    raw_key = "|".join(
        [
            payload.userId,
            payload.jobAnalysis.companyName,
            payload.jobAnalysis.positionName,
            payload.jobAnalysis.jdText[:240],
        ]
    )
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()[:32]


def _build_chunks(payload: CoverLetterFeedbackRequest) -> list[RagChunk]:
    documents = normalize_documents(payload.documents)
    chunks: list[RagChunk] = []
    chunks.extend(chunk_text("JD", payload.jobAnalysis.jdText))
    chunks.extend(chunk_text("coverLetter", documents["coverLetterText"]))
    chunks.extend(chunk_text("resume", documents["resumeText"]))
    chunks.extend(chunk_text("portfolio", documents["portfolioText"]))
    return chunks


# 2026-04-23 신규: JD 분석 결과를 query로 삼아 벡터 저장소에서 근거 chunk를 검색하는 RAG agent
def run_rag_retriever_agent(
    payload: CoverLetterFeedbackRequest,
    jd_context: dict[str, object],
) -> dict[str, object]:
    collection_id = _collection_id(payload)
    chunks = _build_chunks(payload)
    cover_letter_vector_rag_store.delete_collection(collection_id)
    cover_letter_vector_rag_store.upsert_chunks(collection_id, chunks)

    queries = [
        " ".join(list(jd_context["jdKeywords"])[:8]),
        " ".join(list(jd_context["jobFocusKeywords"])[:8]),
        *RAG_QUERY_TEMPLATES,
    ]
    retrieved_by_id: dict[str, RagChunk] = {}
    for query in queries:
        if not query.strip():
            continue
        for chunk in cover_letter_vector_rag_store.search(collection_id, query, limit=4):
            current = retrieved_by_id.get(chunk.chunk_id)
            if current is None or current.score < chunk.score:
                retrieved_by_id[chunk.chunk_id] = chunk

    retrieved_chunks = sorted(
        retrieved_by_id.values(),
        key=lambda chunk: chunk.score,
        reverse=True,
    )[:10]

    return {
        "collectionId": collection_id,
        "chunkCount": len(chunks),
        "retrievedEvidence": [
            {
                "source": chunk.source,
                "text": chunk.text,
                "score": chunk.score,
                "metadata": chunk.metadata,
            }
            for chunk in retrieved_chunks
        ],
    }

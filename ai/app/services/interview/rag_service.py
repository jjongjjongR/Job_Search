import hashlib

from app.schemas.interview import InterviewDocumentsInput
from app.services.cover_letter.vector_rag_store import (
    RagChunk,
    chunk_text,
    cover_letter_vector_rag_store,
)
from app.services.interview.question_planner import normalize_interview_documents


# 2026-05-07 신규: 면접 세션별 JD/사용자 문서 근거를 RAG 검색용 collection으로 구성
def build_interview_rag_collection(
    session_id: str,
    company_name: str,
    position_name: str,
    jd_text: str,
    documents: InterviewDocumentsInput,
) -> str:
    collection_id = _build_collection_id(session_id, company_name, position_name, jd_text)
    normalized_documents = normalize_interview_documents(documents)
    chunks: list[RagChunk] = []
    chunks.extend(chunk_text("JD", jd_text))
    chunks.extend(chunk_text("coverLetter", normalized_documents["coverLetterText"]))
    chunks.extend(chunk_text("resume", normalized_documents["resumeText"]))
    chunks.extend(chunk_text("portfolio", normalized_documents["portfolioText"]))

    cover_letter_vector_rag_store.delete_collection(collection_id)
    cover_letter_vector_rag_store.upsert_chunks(collection_id, chunks)
    return collection_id


# 2026-05-07 신규: 직전 질문/답변/JD를 query로 사용해 면접 평가 근거를 검색
def retrieve_interview_evidence(
    collection_id: str | None,
    query: str,
    limit: int = 5,
) -> list[dict[str, object]]:
    if not collection_id or not query.strip():
        return []

    return [
        {
            "source": chunk.source,
            "text": chunk.text,
            "score": chunk.score,
            "metadata": chunk.metadata,
        }
        for chunk in cover_letter_vector_rag_store.search(
            collection_id=collection_id,
            query=query,
            limit=limit,
        )
    ]


def _build_collection_id(
    session_id: str,
    company_name: str,
    position_name: str,
    jd_text: str,
) -> str:
    raw_key = "|".join(
        [
            "interview",
            session_id,
            company_name,
            position_name,
            jd_text[:240],
        ]
    )
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()[:32]

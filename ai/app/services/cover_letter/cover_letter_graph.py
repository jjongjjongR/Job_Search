from __future__ import annotations

from typing import Any, TypedDict

from app.schemas.cover_letter import CoverLetterFeedbackRequest
from app.services.cover_letter.cover_letter_evaluator_agent import (
    run_cover_letter_evaluator_agent,
)
from app.services.cover_letter.draft_generator_agent import run_draft_generator_agent
from app.services.cover_letter.draft_reviewer_agent import run_draft_reviewer_agent
from app.services.cover_letter.evidence_extractor_agent import (
    run_evidence_extractor_agent,
)
from app.services.cover_letter.jd_analyzer_agent import run_jd_analyzer_agent
from app.services.cover_letter.rag_retriever_agent import run_rag_retriever_agent


class CoverLetterGraphState(TypedDict, total=False):
    payload: CoverLetterFeedbackRequest
    jdContext: dict[str, Any]
    ragContext: dict[str, Any]
    evidenceContext: dict[str, Any]
    evaluationContext: dict[str, Any]
    draftContext: dict[str, Any]
    draftReview: dict[str, Any]
    graphRuntime: str


def _jd_analyzer_node(state: CoverLetterGraphState) -> CoverLetterGraphState:
    state["jdContext"] = run_jd_analyzer_agent(state["payload"])
    return state


def _rag_retriever_node(state: CoverLetterGraphState) -> CoverLetterGraphState:
    state["ragContext"] = run_rag_retriever_agent(
        state["payload"],
        state["jdContext"],
    )
    return state


def _evidence_extractor_node(state: CoverLetterGraphState) -> CoverLetterGraphState:
    state["evidenceContext"] = run_evidence_extractor_agent(
        state["payload"],
        state["jdContext"]["jdKeywords"],
        state["ragContext"],
    )
    return state


def _evaluator_node(state: CoverLetterGraphState) -> CoverLetterGraphState:
    state["evaluationContext"] = run_cover_letter_evaluator_agent(
        payload=state["payload"],
        jd_context=state["jdContext"],
        evidence_context=state["evidenceContext"],
    )
    return state


def _draft_generator_node(state: CoverLetterGraphState) -> CoverLetterGraphState:
    state["draftContext"] = run_draft_generator_agent(
        payload=state["payload"],
        evaluation_context=state["evaluationContext"],
    )
    return state


def _draft_reviewer_node(state: CoverLetterGraphState) -> CoverLetterGraphState:
    state["draftReview"] = run_draft_reviewer_agent(
        payload=state["payload"],
        revised_draft=str(state["draftContext"]["revisedDraft"]),
    )
    return state


def _run_fallback_graph(payload: CoverLetterFeedbackRequest) -> CoverLetterGraphState:
    state: CoverLetterGraphState = {"payload": payload, "graphRuntime": "FALLBACK"}
    for node in [
        _jd_analyzer_node,
        _rag_retriever_node,
        _evidence_extractor_node,
        _evaluator_node,
        _draft_generator_node,
        _draft_reviewer_node,
    ]:
        state = node(state)
    return state


# 2026-04-23 신규: LangGraph가 설치된 환경에서는 실제 StateGraph로 agent 흐름을 실행
def run_cover_letter_langgraph(payload: CoverLetterFeedbackRequest) -> CoverLetterGraphState:
    try:
        from langgraph.graph import END, StateGraph
    except Exception:
        return _run_fallback_graph(payload)

    workflow = StateGraph(CoverLetterGraphState)
    workflow.add_node("jd_analyzer", _jd_analyzer_node)
    workflow.add_node("rag_retriever", _rag_retriever_node)
    workflow.add_node("evidence_extractor", _evidence_extractor_node)
    workflow.add_node("evaluator", _evaluator_node)
    workflow.add_node("draft_generator", _draft_generator_node)
    workflow.add_node("draft_reviewer", _draft_reviewer_node)

    workflow.set_entry_point("jd_analyzer")
    workflow.add_edge("jd_analyzer", "rag_retriever")
    workflow.add_edge("rag_retriever", "evidence_extractor")
    workflow.add_edge("evidence_extractor", "evaluator")
    workflow.add_edge("evaluator", "draft_generator")
    workflow.add_edge("draft_generator", "draft_reviewer")
    workflow.add_edge("draft_reviewer", END)

    graph = workflow.compile()
    initial_state: CoverLetterGraphState = {
        "payload": payload,
        "graphRuntime": "LANGGRAPH",
    }
    return graph.invoke(initial_state)

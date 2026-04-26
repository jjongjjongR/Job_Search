from app.schemas.cover_letter import (
    CoverLetterFeedbackRequest,
    CoverLetterFeedbackResponse,
)
from app.services.cover_letter.cover_letter_graph import run_cover_letter_langgraph
from app.services.cover_letter.shared import fill_to_three


# 2026-04-23 수정: 자소서 agent들을 LangGraph 기반 흐름으로 실행하고 RAG 근거를 평가에 반영
def cover_letter_feedback_service(
    payload: CoverLetterFeedbackRequest,
) -> CoverLetterFeedbackResponse:
    graph_state = run_cover_letter_langgraph(payload)
    evaluation_context = graph_state["evaluationContext"]
    draft_context = graph_state["draftContext"]
    draft_review = graph_state["draftReview"]

    weaknesses = list(evaluation_context["weaknesses"])
    next_actions = list(evaluation_context["nextActions"])

    if not draft_review["approved"]:
        review_reason = str(draft_review["reason"]).strip()
        if review_reason not in weaknesses:
            weaknesses = fill_to_three([review_reason, *weaknesses], weaknesses)
        next_actions = fill_to_three(
            [
                "초안을 바로 외우기보다 JD 연결과 문항 적합도를 먼저 다시 높여 보세요.",
                *next_actions,
            ],
            next_actions,
        )

    return CoverLetterFeedbackResponse(
        totalScore=int(evaluation_context["totalScore"]),
        jdAlignmentScore=int(evaluation_context["jdAlignmentScore"]),
        jobFitScore=int(evaluation_context["jobFitScore"]),
        confidence=float(evaluation_context["confidence"]),
        verifiedJdKeywords=list(evaluation_context["verifiedJdKeywords"]),
        rubricScores=list(evaluation_context["rubricScores"]),
        ragEvidence=list(evaluation_context["retrievedEvidence"]),
        summary=str(evaluation_context["summary"]),
        revisedDraft=str(draft_context["revisedDraft"]),
        questionScores=list(evaluation_context["questionScores"]),
        strengths=list(evaluation_context["strengths"]),
        weaknesses=weaknesses,
        revisionDirections=list(evaluation_context["revisionDirections"]),
        nextActions=next_actions,
    )

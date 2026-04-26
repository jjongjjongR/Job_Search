from app.schemas.common import (
    DecisionNextQuestion,
    DecisionResponse,
    InterviewDecisionType,
    InterviewQuestionType,
)

from app.services.interview.answer_evaluator import build_follow_up_question


# 2026-04-15 신규: 세션 상태와 평가 결과를 보고 꼬리질문 또는 다음 질문을 결정
def resolve_next_interview_step(
    session_state: dict[str, object],
    evaluation: dict[str, object],
) -> DecisionResponse:
    planned_questions = list(session_state.get("plannedQuestions", []))
    current_plan_index = int(session_state.get("currentPlanIndex", 0))
    follow_up_count = int(session_state.get("followUpCountForCurrentQuestion", 0))
    current_question_text = str(session_state.get("currentQuestionText", "")).strip()

    is_sufficient = bool(evaluation.get("isSufficient"))
    follow_up_focus = evaluation.get("followUpFocus")

    if (not is_sufficient) and follow_up_count < 2:
        next_question_text = build_follow_up_question(
            focus=str(follow_up_focus) if follow_up_focus else None,
            question_text=current_question_text,
        )
        return DecisionResponse(
            type=InterviewDecisionType.FOLLOW_UP,
            message="답변의 부족한 부분을 보완하기 위해 꼬리질문을 진행합니다.",
            followUpCountForCurrentQuestion=follow_up_count + 1,
            nextQuestion=DecisionNextQuestion(
                questionType=InterviewQuestionType.FOLLOW_UP,
                questionText=next_question_text,
            ),
        )

    next_plan_index = current_plan_index + 1
    if next_plan_index >= len(planned_questions):
        return DecisionResponse(
            type=InterviewDecisionType.FINISH_SESSION,
            message="기본 질문 흐름을 모두 진행하여 면접을 종료합니다.",
            followUpCountForCurrentQuestion=follow_up_count,
            nextQuestion=None,
        )

    next_question = planned_questions[next_plan_index]
    # 2026-04-15 수정: 충분 답변이 아니어도 꼬리질문 2회 제한으로 넘어가는 경우 안내 문구를 분리
    next_message = (
        "현재 답변이 기준을 충족해 다음 질문으로 넘어갑니다."
        if is_sufficient
        else "현재 질문의 꼬리질문 한도에 도달하여 다음 기본 질문으로 넘어갑니다."
    )
    return DecisionResponse(
        type=InterviewDecisionType.NEXT_QUESTION,
        message=next_message,
        followUpCountForCurrentQuestion=0,
        nextQuestion=DecisionNextQuestion(
            questionType=next_question["questionType"],
            questionText=next_question["questionText"],
        ),
    )

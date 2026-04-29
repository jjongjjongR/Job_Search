# ai/app/services/interview/answer_service.py
# 면접 답변 처리 규칙 기반 응답을 반환하는 서비스 파일

from app.adapters.redis_state_store import redis_interview_state_store
from app.schemas.common import (
    DecisionResponse,
    InterviewDecisionType,
    InterviewQuestionType,
    VisionResultStatus,
)
from app.schemas.interview import (
    InterviewAnswerRequest,
    InterviewAnswerResponse,
    TempArtifacts,
)
from app.services.interview.answer_evaluator import (
    evaluate_interview_answer,
)
from app.services.interview.next_question_resolver import resolve_next_interview_step
from app.services.interview.stt_service import evaluate_stt_fallback
from app.services.interview.vision_service import evaluate_vision_metrics

# 2026.04.01 이종헌 신규
async def interview_answer_service(
    payload: InterviewAnswerRequest,
) -> InterviewAnswerResponse:
    turn_id = str(payload.turnNumber)
    session_state = await redis_interview_state_store.get_session_state(payload.sessionId) or {}
    current_question_text = str(session_state.get("currentQuestionText", "")).strip()
    current_question_type = str(
        session_state.get("currentQuestionType", InterviewQuestionType.SELF_INTRO)
    )
    jd_text = str(session_state.get("jdText", "")).strip()
    position_name = str(session_state.get("positionName", "")).strip()
    retry_count = await redis_interview_state_store.get_stt_retry_count(
        payload.sessionId, turn_id
    )

    # 2026-04-21 수정: STT fallback을 먼저 판정해 재업로드/텍스트 전환을 실제 decision으로 반환
    stt_result = evaluate_stt_fallback(payload, retry_count)
    if not stt_result["accepted"]:
        await redis_interview_state_store.save_stt_retry_count(
            session_id=payload.sessionId,
            turn_id=turn_id,
            retry_count=int(stt_result["retryCount"]),
        )
        await redis_interview_state_store.refresh_session_ttl(payload.sessionId)
        return InterviewAnswerResponse(
            answerFullText="",
            feedbackText=str(stt_result["failureReason"]),
            nonverbalSummaryText="영상 품질 또는 음성 문제로 이번 시도는 평가에 반영하지 않았습니다.",
            visionResultStatus=VisionResultStatus.SKIPPED,
            # 2026.04.25 신규: 재업로드/텍스트 전환 시 이번 시도 점수는 0으로 고정
            contentScore=0,
            # 2026.04.25 신규: 재업로드/텍스트 전환 시 이번 시도 점수는 0으로 고정
            nonverbalScore=0,
            # 2026.04.25 신규: 재업로드/텍스트 전환 시 이번 시도 점수는 0으로 고정
            totalScore=0,
            decision=DecisionResponse(
                type=stt_result["decisionType"],
                message=str(stt_result["message"]),
                retryCount=int(stt_result["retryCount"]),
                followUpCountForCurrentQuestion=int(
                    session_state.get("followUpCountForCurrentQuestion", 0)
                ),
                nextQuestion=None,
            ),
            tempArtifacts=TempArtifacts(
                rawTranscriptKey=f"interview:session:{payload.sessionId}:transcript:{turn_id}",
                rawVisionMetricsKey=f"interview:session:{payload.sessionId}:vision:{turn_id}",
                hiddenScoreKey=f"interview:session:{payload.sessionId}:hidden-score:{turn_id}",
                deleteAfterSeconds=600,
            ),
        )

    answer_full_text = str(stt_result["answerFullText"]).strip()
    if not answer_full_text:
        answer_full_text = "지원 직무와 연결되는 경험을 바탕으로 답변을 정리했습니다."

    evaluation = evaluate_interview_answer(
        question_type=current_question_type,
        question_text=current_question_text,
        answer_text=answer_full_text,
        jd_text=jd_text,
        position_name=position_name,
    )
    vision_result = evaluate_vision_metrics(payload)
    nonverbal_summary_text = str(vision_result["summary"])
    nonverbal_score = int(vision_result["score"])
    hidden_total_score = int(evaluation["scores"]["totalContentScore"]) + nonverbal_score
    decision = resolve_next_interview_step(session_state, evaluation)

    await redis_interview_state_store.save_raw_transcript(
        session_id=payload.sessionId,
        turn_id=turn_id,
        payload={
            "text": answer_full_text,
            "source": stt_result["source"],
            "createdAt": "2026-04-10T00:00:00Z",
        },
    )
    await redis_interview_state_store.save_raw_vision_metrics(
        session_id=payload.sessionId,
        turn_id=turn_id,
        payload={
            **vision_result["metrics"],
            "status": vision_result["status"],
        },
    )
    await redis_interview_state_store.save_hidden_score(
        session_id=payload.sessionId,
        turn_id=turn_id,
        payload={
            "contentScore": evaluation["scores"]["totalContentScore"],
            "nonverbalScore": nonverbal_score,
            "totalScore": hidden_total_score,
            "breakdown": evaluation["scores"],
            "isSufficient": evaluation["isSufficient"],
            "insufficiencyReasons": evaluation["insufficiencyReasons"],
        },
    )
    await redis_interview_state_store.save_stt_retry_count(
        session_id=payload.sessionId,
        turn_id=turn_id,
        retry_count=int(stt_result["retryCount"]),
    )

    response = InterviewAnswerResponse(
        answerFullText=answer_full_text,
        feedbackText=_build_feedback_text(evaluation),
        nonverbalSummaryText=nonverbal_summary_text,
        visionResultStatus=vision_result["status"],
        # 2026.04.25 신규: 13단계 최종 리포트 계산을 위해 턴별 점수를 내부 응답에 포함
        contentScore=int(evaluation["scores"]["totalContentScore"]),
        # 2026.04.25 신규: 13단계 최종 리포트 계산을 위해 턴별 점수를 내부 응답에 포함
        nonverbalScore=nonverbal_score,
        # 2026.04.25 신규: 13단계 최종 리포트 계산을 위해 턴별 점수를 내부 응답에 포함
        totalScore=hidden_total_score,
        decision=decision,
        tempArtifacts=TempArtifacts(
            rawTranscriptKey="temp/raw-transcript/dummy-turn-1.json",
            rawVisionMetricsKey="temp/raw-vision/dummy-turn-1.json",
            hiddenScoreKey="temp/hidden-score/dummy-turn-1.json",
            deleteAfterSeconds=600,
        ),
    )

    # 2026.04.10 신규: 답변 처리 후 세션 관련 key TTL을 다시 연장
    await redis_interview_state_store.refresh_session_ttl(payload.sessionId)

    # 2026.04.10 신규: 다음 질문 기준 현재 세션 state를 Redis에 갱신
    current_plan_index = int(session_state.get("currentPlanIndex", 0))
    if decision.type == "NEXT_QUESTION":
        current_plan_index += 1

    # 2026-04-29 신규: 세션 종료 cleanup에서 임시 업로드 답변 영상을 삭제할 수 있도록 storage key를 상태에 누적
    temp_video_storage_keys = list(session_state.get("tempVideoStorageKeys", []))
    if (
        payload.answerVideoStorageKey
        and payload.answerVideoStorageKey not in temp_video_storage_keys
    ):
        temp_video_storage_keys.append(payload.answerVideoStorageKey)

    await redis_interview_state_store.save_session_state(
        session_id=payload.sessionId,
        payload={
            "status": "IN_PROGRESS",
            "documentSufficiency": session_state.get("documentSufficiency"),
            "currentQuestionNumber": current_plan_index + 1,
            "followUpCountForCurrentQuestion": response.decision.followUpCountForCurrentQuestion,
            "currentPlanIndex": current_plan_index,
            "totalQuestionCount": session_state.get("totalQuestionCount", 10),
            "currentQuestionType": response.decision.nextQuestion.questionType if response.decision.nextQuestion else None,
            "currentQuestionText": response.decision.nextQuestion.questionText if response.decision.nextQuestion else None,
            "lastAnswerType": payload.answerType,
            "lastVisionStatus": vision_result["status"],
            "plannedQuestions": session_state.get("plannedQuestions", []),
            "companyName": session_state.get("companyName"),
            "positionName": position_name,
            "jdText": jd_text,
            "documents": session_state.get("documents", {}),
            "lastEvaluation": evaluation,
            # 2026-04-29 신규: private temp storage의 답변 영상 삭제 대상을 Redis state에 유지
            "tempVideoStorageKeys": temp_video_storage_keys,
        },
    )

    response.tempArtifacts.rawTranscriptKey = (
        f"interview:session:{payload.sessionId}:transcript:{turn_id}"
    )
    response.tempArtifacts.rawVisionMetricsKey = (
        f"interview:session:{payload.sessionId}:vision:{turn_id}"
    )
    response.tempArtifacts.hiddenScoreKey = (
        f"interview:session:{payload.sessionId}:hidden-score:{turn_id}"
    )

    return response


# 2026-04-15 신규: 점수 구조와 부족한 이유를 짧은 피드백 문장으로 정리
def _build_feedback_text(evaluation: dict[str, object]) -> str:
    scores = evaluation["scores"]
    total_score = int(scores["totalContentScore"])
    reasons = list(evaluation.get("insufficiencyReasons", []))

    if evaluation["isSufficient"]:
        return (
            f"내용 점수는 {total_score}/85점입니다. 질문 적합성과 직무 연결이 비교적 안정적이라 다음 질문으로 진행할 수 있습니다."
        )

    top_reason = reasons[0] if reasons else "답변 보완이 더 필요합니다."
    return (
        f"내용 점수는 {total_score}/85점입니다. 현재 답변은 아직 충분 답변 기준에 못 미쳤습니다. "
        f"{top_reason}"
    )

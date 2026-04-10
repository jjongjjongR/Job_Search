# ai/app/services/interview/answer_service.py
# 면접 답변 처리 더미 응답을 반환하는 서비스 파일

from app.adapters.redis_state_store import redis_interview_state_store
from app.schemas.common import (
    DecisionNextQuestion,
    DecisionResponse,
    InterviewDecisionType,
    InterviewQuestionType,
)
from app.schemas.interview import (
    InterviewAnswerRequest,
    InterviewAnswerResponse,
    TempArtifacts,
)

# 2026.04.01 이종헌 신규
async def interview_answer_service(
    payload: InterviewAnswerRequest,
) -> InterviewAnswerResponse:
    turn_id = str(payload.turnNumber)
    answer_full_text = (
        payload.answerText
        if payload.answerType == "TEXT" and payload.answerText
        else "안녕하세요. 백엔드 직무에 지원한 지원자입니다."
    )

    await redis_interview_state_store.save_raw_transcript(
        session_id=payload.sessionId,
        turn_id=turn_id,
        payload={
            "text": answer_full_text,
            "source": "TEXT" if payload.answerType == "TEXT" else "STT",
            "createdAt": "2026-04-10T00:00:00Z",
        },
    )
    await redis_interview_state_store.save_raw_vision_metrics(
        session_id=payload.sessionId,
        turn_id=turn_id,
        payload={
            "faceDetected": payload.answerType == "VIDEO",
            "multiFaceDetected": False,
            "lowLight": False,
            "occlusionDetected": False,
            "status": "SKIPPED" if payload.answerType == "TEXT" else "VALID",
        },
    )
    await redis_interview_state_store.save_hidden_score(
        session_id=payload.sessionId,
        turn_id=turn_id,
        payload={
            "contentScore": 72,
            "nonverbalScore": 9 if payload.answerType == "VIDEO" else 0,
            "totalScore": 81 if payload.answerType == "VIDEO" else 72,
        },
    )
    await redis_interview_state_store.save_stt_retry_count(
        session_id=payload.sessionId,
        turn_id=turn_id,
        retry_count=0,
    )

    response = InterviewAnswerResponse(
        answerFullText="안녕하세요. 백엔드 직무에 지원한 지원자입니다.",
        feedbackText="지원 동기는 보였지만 프로젝트 근거를 더 말하면 좋습니다.",
        nonverbalSummaryText="큰 장해 요소는 없었습니다.",
        decision=DecisionResponse(
            type=InterviewDecisionType.FOLLOW_UP,
            message="본인 역할을 더 구체적으로 설명해 주세요.",
            followUpCountForCurrentQuestion=1,
            nextQuestion=DecisionNextQuestion(
                questionType=InterviewQuestionType.FOLLOW_UP,
                questionText="해당 프로젝트에서 본인이 맡은 역할을 더 구체적으로 설명해 주세요.",
            ),
        ),
        tempArtifacts=TempArtifacts(
            rawTranscriptKey="temp/raw-transcript/dummy-turn-1.json",
            rawVisionMetricsKey="temp/raw-vision/dummy-turn-1.json",
            hiddenScoreKey="temp/hidden-score/dummy-turn-1.json",
            deleteAfterSeconds=600,
        ),
    )

    # 2026.04.10 수정: 텍스트 답변이면 answer_full_text를 사용자 입력 기준으로 유지
    response.answerFullText = answer_full_text

    # 2026.04.10 신규: 답변 처리 후 세션 관련 key TTL을 다시 연장
    await redis_interview_state_store.refresh_session_ttl(payload.sessionId)

    # 2026.04.10 신규: 다음 질문 기준 현재 세션 state를 Redis에 갱신
    await redis_interview_state_store.save_session_state(
        session_id=payload.sessionId,
        payload={
            "status": "IN_PROGRESS",
            "currentQuestionNumber": payload.turnNumber,
            "followUpCountForCurrentQuestion": response.decision.followUpCountForCurrentQuestion,
            "currentQuestionType": response.decision.nextQuestion.questionType if response.decision.nextQuestion else None,
            "currentQuestionText": response.decision.nextQuestion.questionText if response.decision.nextQuestion else None,
            "lastAnswerType": payload.answerType,
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

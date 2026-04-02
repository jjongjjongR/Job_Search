# ai/app/services/interview/answer_service.py
# 면접 답변 처리 더미 응답을 반환하는 서비스 파일

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
def interview_answer_service(
    payload: InterviewAnswerRequest,
) -> InterviewAnswerResponse:
    return InterviewAnswerResponse(
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
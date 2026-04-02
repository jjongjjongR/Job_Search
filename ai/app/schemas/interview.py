# ai/app/schemas/interview.py
# 면접 시작/답변/종료 요청·응답 JSON 형식을 정의하는 파일

from pydantic import BaseModel, Field

from app.schemas.common import (
    DecisionResponse,
    DocumentSufficiency,
    InterviewAnswerType,
    InterviewQuestionType,
    InterviewSessionStatus,
    QuestionItem,
)


class InterviewDocumentsInput(BaseModel):
    """
    2026.04.01 이종헌: 신규
    면접 시작 시 참조하는 사용자 문서 텍스트 묶음.
    """

    coverLetterText: str | None = Field(
        default=None,
        description="자기소개서 텍스트",
    )
    resumeText: str | None = Field(
        default=None,
        description="이력서 텍스트",
    )
    portfolioText: str | None = Field(
        default=None,
        description="포트폴리오 텍스트",
    )


class InterviewStartRequest(BaseModel):
    """
    2026.04.01 이종헌: 신규
    면접 세션 시작 요청 모델.
    """

    userId: str = Field(description="요청 사용자 ID")
    companyName: str = Field(description="회사명")
    positionName: str = Field(description="직무명")
    jdText: str = Field(description="JD 본문")
    documents: InterviewDocumentsInput = Field(description="면접 질문 생성에 참고할 사용자 문서들")


class InterviewSessionState(BaseModel):
    """
    2026.04.01 이종헌: 신규
    세션 진행 중 FastAPI가 응답으로 알려주는 현재 상태.
    """

    # 문서 기준에는 IN_PROGRESS가 핵심이라 status로 고정
    status: InterviewSessionStatus = Field(description="현재 세션 상태")
    currentQuestionNumber: int = Field(description="현재 질문 번호")
    followUpCountForCurrentQuestion: int = Field(
        description="현재 질문에서 사용된 꼬리질문 횟수"
    )


class InterviewStartResponse(BaseModel):
    """
    2026.04.01 이종헌: 신규
    면접 세션 시작 응답 모델.
    """

    documentSufficiency: DocumentSufficiency = Field(description="문서 충분도 판단 결과")
    question: QuestionItem = Field(description="첫 질문 정보")
    sessionState: InterviewSessionState = Field(description="세션 현재 상태")


class InterviewAnswerRequest(BaseModel):
    """
    2026.04.01 이종헌: 신규
    면접 답변 처리 요청 모델.
    - answerType이 VIDEO이면 answerVideoStorageKey를 사용
    - answerType이 TEXT이면 answerText를 사용
    """

    userId: str = Field(description="요청 사용자 ID")
    sessionId: str = Field(description="면접 세션 ID")
    turnNumber: int = Field(description="현재 답변 턴 번호")
    answerType: InterviewAnswerType = Field(description="영상 답변인지 텍스트 답변인지 구분")

    answerVideoStorageKey: str | None = Field(
        default=None,
        description="임시 저장된 답변 영상 storage key. VIDEO일 때 사용",
    )
    answerText: str | None = Field(
        default=None,
        description="텍스트 답변 내용. TEXT일 때 사용",
    )


class TempArtifacts(BaseModel):
    """
    2026.04.01 이종헌: 신규
    세션 종료 후 10분 내 삭제할 임시 산출물 참조값.
    """

    rawTranscriptKey: str | None = Field(
        default=None,
        description="raw transcript 저장 key",
    )
    rawVisionMetricsKey: str | None = Field(
        default=None,
        description="raw vision metrics 저장 key",
    )
    hiddenScoreKey: str | None = Field(
        default=None,
        description="내부 hidden score 저장 key",
    )
    deleteAfterSeconds: int = Field(
        description="임시 데이터 삭제까지 남은 시간(초)",
    )


class InterviewAnswerResponse(BaseModel):
    """
    2026.04.01 이종헌: 신규
    면접 답변 처리 응답 모델.
    answerFullText는 raw transcript 원본이 아니라,
    사용자에게 다시 보여줄 답변 텍스트라는 현재 문서 기준을 반영한다.
    """

    answerFullText: str = Field(description="사용자에게 다시 보여줄 답변 텍스트")
    feedbackText: str = Field(description="현재 답변에 대한 피드백")
    nonverbalSummaryText: str = Field(description="비언어 보조 평가 요약")
    decision: DecisionResponse = Field(description="다음 진행 결정")
    tempArtifacts: TempArtifacts = Field(description="임시 저장 산출물 참조값")


class FinalReport(BaseModel):
    """
    2026.04.01 이종헌: 신규
    면접 종료 시 생성하는 최종 리포트.
    """

    totalScore: int = Field(description="최종 총점")
    grade: str = Field(description="최종 등급 문자열")
    summary: str = Field(description="전체 평가 요약")
    strengths: list[str] = Field(
        default_factory=list,
        description="강점 3개 정도",
    )
    weaknesses: list[str] = Field(
        default_factory=list,
        description="보완점 3개 정도",
    )
    practiceDirections: list[str] = Field(
        default_factory=list,
        description="연습 방향 3개 정도",
    )


class InterviewFinishRequest(BaseModel):
    """
    2026.04.01 이종헌: 신규
    면접 세션 종료 요청 모델.
    """

    userId: str = Field(description="요청 사용자 ID")
    sessionId: str = Field(description="면접 세션 ID")
    reason: str = Field(description="종료 사유. 예: USER_FINISHED")


class InterviewFinishResponse(BaseModel):
    """
    2026.04.01 이종헌: 신규
    면접 세션 종료 응답 모델.
    """

    status: InterviewSessionStatus = Field(description="세션 종료 상태")
    finishedAt: str = Field(description="종료 시각 ISO 문자열")
    finalReport: FinalReport = Field(description="최종 리포트")
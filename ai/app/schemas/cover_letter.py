# ai/app/schemas/cover_letter.py
# 자소서 피드백 요청/응답 JSON 형식을 정의하는 파일

from pydantic import BaseModel, Field


class CoverLetterJobAnalysisInput(BaseModel):
    """
    2026.04.01 이종헌: 신규
    자소서 피드백에서 참조하는 공고 분석 정보.
    """

    companyName: str = Field(description="회사명")
    positionName: str = Field(description="직무명")
    jdText: str = Field(description="JD 본문")


class CoverLetterDocumentsInput(BaseModel):
    """
    2026.04.01 이종헌: 신규
    자소서 피드백에 함께 들어가는 사용자 문서 텍스트 묶음.
    """

    coverLetterText: str | None = Field(
        default=None,
        description="자기소개서 본문 텍스트",
    )
    coverLetterFileText: str | None = Field(
        default=None,
        description="업로드 파일에서 추출한 자기소개서 텍스트",
    )
    resumeText: str | None = Field(
        default=None,
        description="이력서 텍스트. 없어도 됨",
    )
    resumeFileText: str | None = Field(
        default=None,
        description="업로드 파일에서 추출한 이력서 텍스트. 없어도 됨",
    )
    portfolioText: str | None = Field(
        default=None,
        description="포트폴리오 텍스트. 없어도 됨",
    )
    portfolioFileText: str | None = Field(
        default=None,
        description="업로드 파일에서 추출한 포트폴리오 텍스트. 없어도 됨",
    )


class CoverLetterFeedbackRequest(BaseModel):
    """
    2026.04.01 이종헌: 신규
    자소서 피드백 생성 요청 모델.
    내부 API 기준으로는 NestJS가 문서를 읽어 텍스트화한 뒤 FastAPI에 넘긴다.
    """

    userId: str = Field(description="요청 사용자 ID")
    jobAnalysis: CoverLetterJobAnalysisInput = Field(description="공고 기준 정보")
    documents: CoverLetterDocumentsInput = Field(description="자소서/이력서/포트폴리오 텍스트")


class CoverLetterQuestionScore(BaseModel):
    questionNumber: int = Field(description="문항 번호")
    title: str = Field(description="문항 제목")
    score: int = Field(description="문항 점수")
    feedback: str = Field(description="문항별 짧은 피드백")


class CoverLetterRubricScore(BaseModel):
    category: str = Field(description="평가 항목명")
    score: int = Field(description="항목 점수")
    maxScore: int = Field(description="항목 최대 점수")
    evidenceText: str = Field(description="점수 근거 문장")
    evidenceSource: str = Field(description="근거 출처. JD, coverLetter, resume, portfolio 등")
    verified: bool = Field(description="서버가 실제 입력 문서 안 근거 존재를 확인했는지 여부")


class CoverLetterRagEvidence(BaseModel):
    source: str = Field(description="근거 출처. JD, coverLetter, resume, portfolio")
    text: str = Field(description="검색된 근거 chunk")
    score: float = Field(description="벡터 검색 유사도 점수")


class CoverLetterFeedbackResponse(BaseModel):
    """
    2026.04.01 이종헌: 신규
    자소서 피드백 생성 응답 모델.
    """

    totalScore: int = Field(description="종합 점수")
    jdAlignmentScore: int = Field(description="JD 반영도 점수")
    jobFitScore: int = Field(description="직무 적합도 점수")
    confidence: float = Field(description="점수 신뢰도 0.0~1.0")
    verifiedJdKeywords: list[str] = Field(
        default_factory=list,
        description="JD 원문 안에서 확인된 평가 기준 키워드",
    )
    rubricScores: list[CoverLetterRubricScore] = Field(
        default_factory=list,
        description="근거 검증이 포함된 항목별 점수",
    )
    ragEvidence: list[CoverLetterRagEvidence] = Field(
        default_factory=list,
        description="벡터 DB 기반 RAG로 검색된 상위 근거",
    )
    summary: str = Field(description="전체 요약")
    revisedDraft: str = Field(description="현재 자료를 바탕으로 만든 자소서 수정 초안")
    questionScores: list[CoverLetterQuestionScore] = Field(
        default_factory=list,
        description="문항별 점수와 짧은 피드백",
    )
    strengths: list[str] = Field(
        default_factory=list,
        description="강점 3개 정도를 담는 배열",
    )
    weaknesses: list[str] = Field(
        default_factory=list,
        description="보완점 3개 정도를 담는 배열",
    )
    revisionDirections: list[str] = Field(
        default_factory=list,
        description="수정 방향 3개 정도를 담는 배열",
    )
    nextActions: list[str] = Field(
        default_factory=list,
        description="다음 액션 3개 정도를 담는 배열",
    )

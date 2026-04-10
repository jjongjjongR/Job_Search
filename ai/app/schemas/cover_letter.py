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


class CoverLetterFeedbackResponse(BaseModel):
    """
    2026.04.01 이종헌: 신규
    자소서 피드백 생성 응답 모델.
    """

    totalScore: int = Field(description="종합 점수")
    summary: str = Field(description="전체 요약")
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

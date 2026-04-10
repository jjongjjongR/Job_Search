# ai/app/schemas/jobs.py
# 공고 분석 요청/응답 JSON 형식을 정의하는 파일

from pydantic import BaseModel, Field


class JobAnalyzeRequest(BaseModel):
    """
    2026.04.01 이종헌: 신규
    공고 분석 요청 모델.
    - jobUrl이 있으면 링크 기반 분석을 시도한다.
    - 링크 분석 실패나 직접 입력 흐름에서는 manual* 값을 사용한다.
    """

    jobUrl: str | None = Field(
        default=None,
        description="분석할 공고 링크. 있으면 URL 분석 우선",
    )
    manualCompanyName: str | None = Field(
        default=None,
        description="링크 분석 실패 시 수동 회사명 입력값",
    )
    manualPositionName: str | None = Field(
        default=None,
        description="링크 분석 실패 시 수동 직무명 입력값",
    )
    manualJobTitle: str | None = Field(
        default=None,
        description="문서 기준 수동 직무명 입력값 별칭",
    )
    manualJdText: str | None = Field(
        default=None,
        description="링크 분석 실패 시 수동 JD 본문 입력값",
    )


class JobAnalyzeResponse(BaseModel):
    """
    2026.04.01 이종헌: 신규
    공고 분석 응답 모델.
    이후 자소서 피드백과 면접 세션의 기준 정보로 재사용된다.
    """

    companyName: str = Field(description="정리된 회사명")
    positionName: str = Field(description="정리된 직무명")
    jdText: str = Field(description="정리된 JD 본문")
    extractedSkills: list[str] = Field(
        default_factory=list,
        description="JD에서 추출한 핵심 기술 목록",
    )
    extractedKeywords: list[str] = Field(
        default_factory=list,
        description="JD에서 추출한 핵심 키워드 목록",
    )
    keywords: list[str] = Field(
        default_factory=list,
        description="JD에서 추출한 핵심 키워드 목록",
    )
    sourceType: str | None = Field(
        default=None,
        description="URL 분석인지 MANUAL 입력인지 표시하는 값",
    )
    # 2026-04-10 신규: 공고 분석 처리 상태를 응답에 포함
    status: str = Field(
        default="COMPLETED",
        description="공고 분석 처리 상태",
    )

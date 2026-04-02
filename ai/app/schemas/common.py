# ai/app/schemas/common.py
# 공통 응답 형식, 공통 enum, 공통 모델을 모아두는 파일

from enum import StrEnum
from pydantic import BaseModel, Field


# ----------------------------------------
# 공통 enum
# 여러 API에서 같이 쓰는 상태값/코드값을 여기 모아둔다.
# ----------------------------------------

class DocumentSufficiency(StrEnum):
    """
    2026.04.01 이종헌: 신규
    인터뷰 세션 시작 전, 사용자가 제출한 문서의 충분성을 나타내는 상태값.
    """
    # JD + 사용자 문서(이력서/포트폴리오 등) 1개 이상 존재하여 인터뷰 진행 가능
    SUFFICIENT = "SUFFICIENT"
    # JD만 존재하고 사용자 문서가 없음
    JD_ONLY = "JD_ONLY"
    # JD도 없고 사용자 문서도 없거나 빈약하여 인터뷰 진행 불가
    INSUFFICIENT = "INSUFFICIENT"


class InterviewSessionStatus(StrEnum):
    """
    2026.04.01 이종헌: 신규
    인터뷰 세션의 현재 진행 상태값.
    """
    # 세션이 정상적으로 진행 중
    IN_PROGRESS = "IN_PROGRESS"
    # 세션이 정상 종료되었고 리포트 생성까지 완료됨
    FINISHED = "FINISHED"
    # 시스템 오류 등으로 세션이 정상적으로 진행 불가한 상태
    FAILED = "FAILED"
    # 사용자가 중간에 종료했거나 리포트 없이 종료 처리된 상태
    CANCELLED = "CANCELLED"


class InterviewQuestionType(StrEnum):
    """
    2026.04.01 이종헌: 신규
    인터뷰 질문의 유형. 질문 생성 및 리포트 분류에 사용된다.
    """
    # 자기소개 질문
    SELF_INTRO = "SELF_INTRO"
    # 지원 동기 질문
    MOTIVATION = "MOTIVATION"
    # JD 기반 직무 적합성 질문
    JD_FIT = "JD_FIT"
    # 주요 프로젝트 심층 질문
    PROJECT_DEEP_DIVE = "PROJECT_DEEP_DIVE"
    # 주요 프로젝트 외 다른 프로젝트 관련 질문
    OTHER_PROJECT = "OTHER_PROJECT"
    # 협업 및 문제 해결 경험 질문
    COLLAB_PROBLEM_SOLVING = "COLLAB_PROBLEM_SOLVING"
    # 마무리 질문
    CLOSING = "CLOSING"
    # 이전 답변에 대한 꼬리 질문
    FOLLOW_UP = "FOLLOW_UP"

class InterviewAnswerType(StrEnum):
    """
    2026.04.01 이종헌: 신규
    사용자가 답변을 제출하는 방식.
    """
    # 영상으로 답변 제출
    VIDEO = "VIDEO"
    # 텍스트로 답변 제출
    TEXT = "TEXT"


class InterviewDecisionType(StrEnum):
    """
    2026.04.01 이종헌: 신규
    답변 처리 후 다음 진행 방향을 결정하는 값.
    프론트엔드는 이 값을 기준으로 다음 액션을 분기한다.
    """
    # 영상 품질 문제 등으로 재업로드 요청
    RETRY_UPLOAD = "RETRY_UPLOAD"
    # 영상 처리 불가로 텍스트 답변 요청
    REQUEST_TEXT = "REQUEST_TEXT"
    # 현재 질문에 대한 꼬리 질문 진행
    FOLLOW_UP = "FOLLOW_UP"
    # 다음 질문으로 넘어감
    NEXT_QUESTION = "NEXT_QUESTION"
    # 인터뷰 세션 종료
    FINISH_SESSION = "FINISH_SESSION"

class VisionResultStatus(StrEnum):
    """
    2026.04.01 이종헌: 신규  
    영상 답변의 품질 검사(Vision) 결과 상태값.
    """
    # 영상 품질이 정상이며 답변으로 사용 가능
    VALID = "VALID"
    # 영상 품질이 다소 저하됐지만 답변으로 사용 가능
    WEAKENED = "WEAKENED"
    # 영상 품질이 너무 낮아 답변으로 사용 불가
    INVALID = "INVALID"
    # Vision 검사를 건너뜀 (텍스트 답변 등의 이유로)
    SKIPPED = "SKIPPED"

class ErrorCode(StrEnum):
    """
    2026.04.01 이종헌: 신규
    AI 서비스에서 발생할 수 있는 에러코드 목록. 
    프론트엔드/호출자가 에러 유형을 분기 처리할 때 사용한다.
    """
    # 문서가 부족하여 인터뷰 세션을 시작할 수 없음
    DOCUMENT_INSUFFICIENT = "DOCUMENT_INSUFFICIENT"
    # 첫 번째 질문 생성에 실패함
    FIRST_QUESTION_GENERATION_FAILED = "FIRST_QUESTION_GENERATION_FAILED"
    # 요청한 세션 ID를 찾을 수 없음
    SESSION_NOT_FOUND = "SESSION_NOT_FOUND"
    # 클라이언트가 보낸 턴 번호가 서버 상태와 일치하지 않음
    TURN_NUMBER_MISMATCH = "TURN_NUMBER_MISMATCH"
    # 답변 파일 업로드에 실패함
    ANSWER_UPLOAD_FAILED = "ANSWER_UPLOAD_FAILED"
    # STT(음성→텍스트) 변환에 실패함
    STT_FAILED = "STT_FAILED"
    # 영상 답변을 처리할 수 없어 텍스트 답변이 필요함
    TEXT_ANSWER_REQUIRED = "TEXT_ANSWER_REQUIRED"
    # 영상 품질 검사(Vision) 결과가 유효하지 않음
    VISION_INVALID = "VISION_INVALID"
    # 다음 질문 생성에 실패함
    NEXT_QUESTION_GENERATION_FAILED = "NEXT_QUESTION_GENERATION_FAILED"
    # 세션 진행 턴이 너무 짧아 리포트를 생성할 수 없음
    SESSION_TOO_SHORT_TO_REPORT = "SESSION_TOO_SHORT_TO_REPORT"
    # 임시 파일/데이터 정리가 아직 완료되지 않은 상태
    TEMP_CLEANUP_PENDING = "TEMP_CLEANUP_PENDING"
    # 내부 AI 서비스에 접근할 수 없음
    INTERNAL_AI_UNAVAILABLE = "INTERNAL_AI_UNAVAILABLE"
    # 내부 인증이 유효하지 않음
    INTERNAL_AUTH_INVALID = "INTERNAL_AUTH_INVALID"
    # 요청 값이 유효하지 않음 (잘못된 파라미터 등)
    INVALID_REQUEST = "INVALID_REQUEST"


# ----------------------------------------
# 공통 응답 조각
# 여러 API 응답에서 재사용되는 작은 모델들
# ----------------------------------------

class QuestionItem(BaseModel):
    """
    2026.04.01 이종헌: 신규
    다음에 사용자에게 보여줄 질문 정보.
    """

    # public API에서는 turnNumber가 필요할 수 있어서 optional로 둔다.
    turnNumber: int | None = Field(default=None, description="질문 순번")
    questionType: InterviewQuestionType = Field(description="질문 타입")
    questionText: str = Field(description="실제 질문 문장")


class DecisionNextQuestion(BaseModel):
    """
    2026.04.01 이종헌: 신규
    decision 안에 들어가는 다음 질문 객체.
    """

    questionType: InterviewQuestionType = Field(description="다음 질문 타입")
    questionText: str = Field(description="다음 질문 문장")


class DecisionResponse(BaseModel):
    """
    2026.04.01 이종헌: 신규
    답변 처리 후, 다음에 무엇을 해야 하는지 알려주는 공통 decision 객체.
    """

    type: InterviewDecisionType = Field(description="다음 진행 결정값")
    message: str = Field(description="프론트에 바로 보여줄 안내 문장")

    # 재업로드일 때만 사용
    retryCount: int | None = Field(
        default=None,
        description="현재 재업로드 횟수. RETRY_UPLOAD일 때만 사용",
    )

    # 꼬리질문 또는 다음 질문 진행 시 사용
    followUpCountForCurrentQuestion: int | None = Field(
        default=None,
        description="현재 질문에서 사용한 꼬리질문 횟수",
    )

    # FOLLOW_UP / NEXT_QUESTION일 때만 사용
    nextQuestion: DecisionNextQuestion | None = Field(
        default=None,
        description="다음에 보여줄 질문 정보",
    )


class ErrorDetails(BaseModel):
    """
    2026.04.01 이종헌: 신규
    공통 에러 응답의 details 필드.
    """

    retryCount: int | None = Field(default=None, description="재시도 횟수 등 추가 정보")


class ErrorResponse(BaseModel):
    """
    2026.04.01 이종헌: 신규
    공개 API / 내부 API 공통 에러 응답 형식.
    """

    errorCode: ErrorCode = Field(description="프론트 또는 호출자가 분기할 에러 코드")
    message: str = Field(description="기본 에러 메시지")
    retryable: bool = Field(description="재시도 가능한 에러인지 여부")
    details: ErrorDetails | None = Field(default=None, description="추가 세부 정보")

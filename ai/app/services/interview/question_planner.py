import re

from app.schemas.common import DocumentSufficiency, InterviewQuestionType
from app.schemas.interview import InterviewDocumentsInput


QUESTION_PLAN_TYPES = [
    InterviewQuestionType.SELF_INTRO,
    InterviewQuestionType.MOTIVATION,
    InterviewQuestionType.JD_FIT,
    InterviewQuestionType.JD_FIT,
    InterviewQuestionType.PROJECT_DEEP_DIVE,
    InterviewQuestionType.PROJECT_DEEP_DIVE,
    InterviewQuestionType.OTHER_PROJECT,
    InterviewQuestionType.OTHER_PROJECT,
    InterviewQuestionType.COLLAB_PROBLEM_SOLVING,
    InterviewQuestionType.CLOSING,
]


# 2026-04-15 신규: 문서 충분도와 질문 생성에 공통으로 사용할 입력 텍스트를 정리
def normalize_interview_documents(documents: InterviewDocumentsInput) -> dict[str, str]:
    return {
        "coverLetterText": (documents.coverLetterText or "").strip(),
        "resumeText": (documents.resumeText or "").strip(),
        "portfolioText": (documents.portfolioText or "").strip(),
    }


# 2026-04-15 신규: 질문 반복을 줄이기 위해 JD와 문서에서 대표 키워드를 추출
def extract_interview_keywords(position_name: str, jd_text: str) -> list[str]:
    merged = f"{position_name}\n{jd_text}"
    keywords: list[str] = []
    stopwords = {
        "경험",
        "직무",
        "업무",
        "지원",
        "기술",
        "프로젝트",
        "역량",
        "개발",
        "관련",
        "기반",
    }

    for token in re.findall(r"[A-Za-z][A-Za-z0-9.+#-]{1,}|[가-힣]{2,}", merged):
        normalized = token.strip()
        if normalized.lower() in stopwords or normalized in stopwords:
            continue
        if normalized not in keywords:
            keywords.append(normalized)
        if len(keywords) >= 6:
            break
    return keywords


# 2026-04-15 신규: 문서 안에서 프로젝트/경험 앵커 문장을 찾아 질문에 재사용
def extract_experience_anchors(documents: dict[str, str]) -> list[str]:
    merged_lines = []
    for text in documents.values():
        merged_lines.extend(
            line.strip(" -•\t")
            for line in text.splitlines()
            if line.strip(" -•\t")
        )

    anchors: list[str] = []
    for line in merged_lines:
        if len(line) < 6:
            continue
        if any(signal in line for signal in ["프로젝트", "경험", "실습", "분석", "개선", "설계", "최적화"]):
            anchors.append(line[:48].strip())
        if len(anchors) >= 4:
            break

    if not anchors:
        anchors = ["가장 자신 있는 경험", "직무와 가까운 프로젝트", "다른 성격의 경험", "협업 사례"]
    while len(anchors) < 4:
        anchors.append(anchors[-1])
    return anchors[:4]


# 2026-04-15 신규: 120자 이내 권장 규칙에 맞춰 질문 문장을 정리
def trim_question_text(question_text: str, limit: int = 120) -> str:
    compact = re.sub(r"\s+", " ", question_text).strip()
    if len(compact) <= limit:
        return compact
    return compact[: limit - 1].rstrip() + "?"


# 2026-04-15 신규: 10문항 고정 질문 계획을 규칙 기반으로 생성
def build_question_plan(
    company_name: str,
    position_name: str,
    jd_text: str,
    documents: InterviewDocumentsInput,
    document_sufficiency: DocumentSufficiency = DocumentSufficiency.SUFFICIENT,
) -> list[dict[str, str | int]]:
    normalized_documents = normalize_interview_documents(documents)
    keywords = extract_interview_keywords(position_name, jd_text)
    primary_keyword = keywords[0] if keywords else position_name
    secondary_keyword = keywords[1] if len(keywords) > 1 else "핵심 역량"
    anchors = extract_experience_anchors(normalized_documents)

    raw_questions = [
        (
            1,
            InterviewQuestionType.SELF_INTRO,
            "1분 자기소개 부탁드립니다.",
        ),
        (
            2,
            InterviewQuestionType.MOTIVATION,
            f"{company_name} {position_name} 직무에 지원한 이유를 말씀해 주세요.",
        ),
        (
            3,
            InterviewQuestionType.JD_FIT,
            f"이 직무에서 중요한 {primary_keyword}와 가장 잘 맞는 본인 경험은 무엇인가요?",
        ),
        (
            4,
            InterviewQuestionType.JD_FIT,
            f"{secondary_keyword} 역량을 실제로 보여준 사례를 하나 설명해 주세요.",
        ),
        (
            5,
            InterviewQuestionType.PROJECT_DEEP_DIVE,
            (
                f"{anchors[0]} 경험에서 해결하려던 문제와 접근 방식을 설명해 주세요."
                if document_sufficiency == DocumentSufficiency.SUFFICIENT
                else f"{primary_keyword}와 관련해 본인이 가장 자신 있는 경험이나 학습 과정을 설명해 주세요."
            ),
        ),
        (
            6,
            InterviewQuestionType.PROJECT_DEEP_DIVE,
            (
                f"{anchors[1]} 경험에서 사용한 기술 선택 이유와 어려웠던 점을 말해 주세요."
                if document_sufficiency == DocumentSufficiency.SUFFICIENT
                else f"{secondary_keyword} 역량을 준비하기 위해 어떤 방식으로 학습하고 적용했는지 말씀해 주세요."
            ),
        ),
        (
            7,
            InterviewQuestionType.OTHER_PROJECT,
            (
                f"{anchors[2]} 경험은 앞선 사례와 어떻게 달랐는지 설명해 주세요."
                if document_sufficiency == DocumentSufficiency.SUFFICIENT
                else "직무와 관련해 다른 성격의 경험이나 과제를 수행한 사례가 있다면 소개해 주세요."
            ),
        ),
        (
            8,
            InterviewQuestionType.OTHER_PROJECT,
            (
                "다른 프로젝트 중 결과를 수치나 근거로 설명할 수 있는 경험을 소개해 주세요."
                if document_sufficiency == DocumentSufficiency.SUFFICIENT
                else "최근 준비 과정에서 가장 성장했다고 느낀 경험을 근거 중심으로 설명해 주세요."
            ),
        ),
        (
            9,
            InterviewQuestionType.COLLAB_PROBLEM_SOLVING,
            "협업 중 갈등이나 문제를 해결했던 경험을 말씀해 주세요.",
        ),
        (
            10,
            InterviewQuestionType.CLOSING,
            f"마지막으로 {company_name} {position_name} 직무에서 본인의 강점을 한 문장으로 정리해 주세요.",
        ),
    ]

    planned_questions: list[dict[str, str | int]] = []
    used_texts: set[str] = set()
    for turn_number, question_type, question_text in raw_questions:
        trimmed = trim_question_text(question_text)
        if trimmed in used_texts:
            trimmed = trim_question_text(f"{trimmed} 구체적인 예시도 함께 부탁드립니다.")
        used_texts.add(trimmed)
        planned_questions.append(
            {
                "turnNumber": turn_number,
                "questionType": question_type,
                "questionText": trimmed,
            }
        )

    return planned_questions

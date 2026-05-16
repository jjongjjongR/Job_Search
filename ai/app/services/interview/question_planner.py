import json
import re

import httpx

from app.core.config import settings
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

OPENAI_TIMEOUT_SECONDS = 20.0


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
        "인턴십",
        "채용전환형",
        "채용",
        "경력",
        "제조",
    }
    fallback_signals = [
        "백엔드",
        "트래픽",
        "API",
        "마이크로서비스",
        "통신",
        "커넥티드",
        "게이트웨이",
        "아키텍처",
    ]

    # 2026-05-06 수정: LLM 실패 시에도 기술 명사구 형태를 우선 추출해 fallback 질문 품질을 유지
    for line in merged.splitlines():
        cleaned_line = re.sub(r"^[■\-·\s]+", "", line).strip()
        if not cleaned_line or not any(signal in cleaned_line for signal in fallback_signals):
            continue
        line_candidates = [
            r"RESTful/gRPC API",
            r"[가-힣A-Za-z0-9.+#/-]{2,}\s+백엔드",
            r"대규모\s+[가-힣A-Za-z0-9.+#/-]*\s*트래픽",
            r"글로벌\s+[가-힣A-Za-z0-9.+#/-]+\s+게이트웨이",
            r"마이크로서비스(?:\s+기반)?",
            r"무선\s*통신\s*시스템",
            r"커넥티드\s+카\s+서비스",
        ]
        for pattern in line_candidates:
            match = re.search(pattern, cleaned_line)
            if not match:
                continue
            normalized_phrase = re.sub(r"\s+", " ", match.group(0)).strip()
            if normalized_phrase not in keywords:
                keywords.append(normalized_phrase)

    phrase_patterns = [
        r"[A-Za-z][A-Za-z0-9.+#/-]*(?:/[A-Za-z][A-Za-z0-9.+#/-]*)?\s*API",
        r"[가-힣A-Za-z0-9.+#/-]{2,}(?:\s+[가-힣A-Za-z0-9.+#/-]{2,}){0,3}\s*(?:서비스|시스템|플랫폼|아키텍처|게이트웨이|트래픽|마이크로서비스|통신)",
        r"[A-Za-z][A-Za-z0-9.+#/-]*(?:/[A-Za-z][A-Za-z0-9.+#/-]*)?",
    ]
    for pattern in phrase_patterns:
        for phrase in re.findall(pattern, merged):
            normalized_phrase = re.sub(r"\s+", " ", phrase).strip(" -·.,")
            if not normalized_phrase:
                continue
            if normalized_phrase in stopwords:
                continue
            if normalized_phrase not in keywords:
                keywords.append(normalized_phrase)

    for token in re.findall(r"[A-Za-z][A-Za-z0-9.+#-]{1,}|[가-힣]{2,}", merged):
        normalized_phrase = token.strip()
        if not normalized_phrase:
            continue
        if normalized_phrase.lower() in stopwords or normalized_phrase in stopwords:
            continue
        if normalized_phrase not in keywords:
            keywords.append(normalized_phrase)

    # 2026-05-06 신규: fallback에서만 면접 질문 가치가 높은 기술 명사구를 앞쪽으로 정렬
    def fallback_priority(keyword: str) -> int:
        priority_signals = ["백엔드", "트래픽", "RESTful", "gRPC", "마이크로서비스", "통신", "커넥티드"]
        for index, signal in enumerate(priority_signals):
            if signal in keyword:
                return index
        return len(priority_signals)

    diverse_keywords: list[str] = []
    used_signal_groups: set[str] = set()
    for keyword in sorted(keywords, key=fallback_priority):
        signal_group = next(
            (signal for signal in ["백엔드", "트래픽", "RESTful", "gRPC", "마이크로서비스", "통신", "커넥티드"] if signal in keyword),
            keyword,
        )
        if signal_group in used_signal_groups:
            continue
        used_signal_groups.add(signal_group)
        diverse_keywords.append(keyword)
        if len(diverse_keywords) >= 6:
            break
    return diverse_keywords


# 2026-05-06 신규: JD/사용자 문서를 바탕으로 LLM이 개인화 질문 계획을 생성
def _request_llm_question_plan(
    company_name: str,
    position_name: str,
    jd_text: str,
    documents: dict[str, str],
    document_sufficiency: DocumentSufficiency,
) -> list[dict[str, str | int]] | None:
    if not settings.OPENAI_API_KEY:
        return None

    system_prompt = """
너는 실제 면접관처럼 질문 계획을 만드는 interview_question_planner agent다.
반드시 JSON만 반환한다.

규칙:
1. 총 10문항을 만든다.
2. 1번은 반드시 "1분 자기소개 부탁드립니다."로 고정한다.
3. 질문 타입 순서는 SELF_INTRO, MOTIVATION, JD_FIT, JD_FIT, PROJECT_DEEP_DIVE, PROJECT_DEEP_DIVE, OTHER_PROJECT, OTHER_PROJECT, COLLAB_PROBLEM_SOLVING, CLOSING이다.
4. JD_FIT 질문은 JD의 직무상세, 지원자격, 우대사항에서 뽑은 구체 키워드를 반드시 포함한다.
5. "인턴십 역량", "핵심 역량", "좋은 사례"처럼 추상적인 질문을 만들지 않는다.
6. 사용자 문서가 있으면 프로젝트 질문은 사용자 문서의 실제 프로젝트/경험을 기준으로 만든다.
7. 사용자 문서가 부족하면 프로젝트 질문은 JD 역량을 준비한 학습/경험 질문으로 바꾼다.
8. 각 질문은 120자 이내, 한 문장 중심으로 작성한다.
9. JD에서 역할/도메인/아키텍처/트래픽/API/통신/우대기술을 먼저 추론하고, 그중 면접 질문 가치가 높은 명사구를 질문에 사용한다.
10. 채용 형태, 메뉴명, 회사 일반 소개가 아니라 실제 수행 업무와 우대사항을 질문 근거로 삼는다.

반환 형식:
{
  "questions": [
    {"turnNumber": 1, "questionType": "SELF_INTRO", "questionText": "1분 자기소개 부탁드립니다."}
  ]
}
""".strip()

    request_body = {
        "model": settings.OPENAI_JOB_ANALYSIS_MODEL,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "companyName": company_name,
                        "positionName": position_name,
                        "jdText": jd_text[:6000],
                        # 2026-05-06 신규: 질문 생성 비용과 지연을 줄이기 위해 문서별 핵심 범위만 전달
                        "documents": {
                            key: value[:3000] for key, value in documents.items()
                        },
                        "documentSufficiency": document_sufficiency,
                    },
                    ensure_ascii=False,
                ),
            },
        ],
        "temperature": 0.2,
    }

    try:
        with httpx.Client(timeout=OPENAI_TIMEOUT_SECONDS) as client:
            response = client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=request_body,
            )
            response.raise_for_status()
            data = response.json()
        parsed = json.loads(data["choices"][0]["message"]["content"])
        questions = parsed.get("questions", [])
        if not isinstance(questions, list):
            return None
        return _normalize_question_plan(questions, jd_text)
    except Exception:
        return None


# 2026-05-06 신규: 별도 LLM 검증 agent로 질문이 JD/문서 근거에 맞는지 확인
def _request_llm_question_guardrail(
    questions: list[dict[str, str | int]],
    jd_text: str,
    documents: dict[str, str],
) -> bool:
    if not settings.OPENAI_API_KEY:
        return True

    system_prompt = """
너는 interview_question_guardrail agent다.
질문 목록이 JD와 사용자 문서에 근거하는지 검증한다.
JSON만 반환한다.

통과 기준:
- 질문이 너무 일반적이지 않다.
- JD_FIT 질문에 JD 직무상세/지원자격/우대사항 키워드가 반영되어 있다.
- 사용자 문서에 없는 경험을 특정해서 지어내지 않는다.
- 꼬리질문이 아니라 기본 질문 계획으로 자연스럽다.

반환 형식:
{"valid": true, "reason": "문자열"}
""".strip()

    request_body = {
        "model": settings.OPENAI_JOB_ANALYSIS_MODEL,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "questions": questions,
                        "jdText": jd_text[:5000],
                        # 2026-05-06 신규: 검증 agent에도 문서 전문 대신 판단 가능한 핵심 범위만 전달
                        "documents": {
                            key: value[:2500] for key, value in documents.items()
                        },
                    },
                    ensure_ascii=False,
                ),
            },
        ],
        "temperature": 0.0,
    }

    try:
        with httpx.Client(timeout=OPENAI_TIMEOUT_SECONDS) as client:
            response = client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=request_body,
            )
            response.raise_for_status()
            data = response.json()
        parsed = json.loads(data["choices"][0]["message"]["content"])
        return bool(parsed.get("valid"))
    except Exception:
        return False


# 2026-05-06 신규: LLM 질문 결과를 서버 규칙에 맞는 10문항 계획으로 정규화
def _normalize_question_plan(
    questions: list[object],
    jd_text: str,
) -> list[dict[str, str | int]] | None:
    if len(questions) != len(QUESTION_PLAN_TYPES):
        return None

    normalized_questions: list[dict[str, str | int]] = []
    used_texts: set[str] = set()
    jd_keywords = extract_interview_keywords("", jd_text)
    generic_blocks = ["인턴십 역량", "핵심 역량", "좋은 사례", "관련 사례"]

    for index, raw_question in enumerate(questions):
        if not isinstance(raw_question, dict):
            return None
        question_type = str(raw_question.get("questionType") or "").strip()
        expected_type = QUESTION_PLAN_TYPES[index].value
        if question_type != expected_type:
            return None
        question_text = trim_question_text(str(raw_question.get("questionText") or ""))
        if not question_text or question_text in used_texts:
            return None
        if any(block in question_text for block in generic_blocks):
            return None
        if index == 0:
            question_text = "1분 자기소개 부탁드립니다."
        if QUESTION_PLAN_TYPES[index] == InterviewQuestionType.JD_FIT and not any(
            keyword in question_text for keyword in jd_keywords[:8]
        ):
            return None
        used_texts.add(question_text)
        normalized_questions.append(
            {
                "turnNumber": index + 1,
                "questionType": expected_type,
                "questionText": question_text,
            }
        )

    return normalized_questions


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
    # 2026-05-06 신규: LLM 질문 생성 agent와 검증 agent를 통과한 개인화 질문 계획을 우선 사용
    llm_question_plan = _request_llm_question_plan(
        company_name=company_name,
        position_name=position_name,
        jd_text=jd_text,
        documents=normalized_documents,
        document_sufficiency=document_sufficiency,
    )
    if llm_question_plan and _request_llm_question_guardrail(
        questions=llm_question_plan,
        jd_text=jd_text,
        documents=normalized_documents,
    ):
        return llm_question_plan

    keywords = extract_interview_keywords(position_name, jd_text)
    primary_keyword = keywords[0] if keywords else position_name
    secondary_keyword = keywords[1] if len(keywords) > 1 else "핵심 역량"
    # 2026-05-06 신규: RESTful/gRPC처럼 함께 쓰이는 API 키워드는 질문에서 자연스럽게 묶어 표현
    if "RESTful" in keywords and "gRPC" in keywords:
        secondary_keyword = "RESTful/gRPC API 기반 백엔드 개발"
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
            f"{primary_keyword} 업무와 연결되는 본인 경험이나 학습 과정을 설명해 주세요.",
        ),
        (
            4,
            InterviewQuestionType.JD_FIT,
            f"{secondary_keyword}을 실제 개발이나 학습에서 어떻게 이해하고 적용했는지 말씀해 주세요.",
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

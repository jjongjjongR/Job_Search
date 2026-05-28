from app.core.config import settings
from app.schemas.cover_letter import (
    CoverLetterDocumentsInput,
    CoverLetterFeedbackRequest,
    CoverLetterJobAnalysisInput,
)
from app.schemas.interview import InterviewDocumentsInput
from app.services.cover_letter.cover_letter_evaluator_agent import (
    OPENAI_EVIDENCE_JUDGE_PROMPT,
    OPENAI_EVALUATOR_PROMPT,
    run_cover_letter_evaluator_agent,
)
import app.services.cover_letter.cover_letter_evaluator_agent as cover_letter_evaluator_agent
import app.services.cover_letter.jd_analyzer_agent as jd_analyzer_agent
from app.services.cover_letter.draft_generator_agent import OPENAI_DRAFT_PROMPT
from app.services.cover_letter.draft_reviewer_agent import OPENAI_REVIEW_PROMPT
from app.services.cover_letter.evidence_extractor_agent import (
    run_evidence_extractor_agent,
)
from app.services.cover_letter.evaluation_validator_agent import (
    run_cover_letter_evaluation_validator_agent,
)
from app.services.cover_letter.jd_analyzer_agent import run_jd_analyzer_agent
from app.services.cover_letter.jd_analyzer_agent import OPENAI_JD_ANALYZER_PROMPT
from app.services.cover_letter.rag_retriever_agent import run_rag_retriever_agent
from app.services.cover_letter.vector_rag_store import (
    CHUNK_MAX_CHARS,
    CHUNK_OVERLAP_CHARS,
    chunk_text,
)
from app.services.interview.answer_evaluator import evaluate_interview_answer
from app.services.interview.evaluation_validator import validate_interview_evaluation
from app.services.interview.rag_service import (
    build_interview_rag_collection,
    retrieve_interview_evidence,
)


def _cover_letter_payload() -> CoverLetterFeedbackRequest:
    return CoverLetterFeedbackRequest(
        userId="user-no-cost",
        jobAnalysis=CoverLetterJobAnalysisInput(
            companyName="OpenAI Korea",
            positionName="Backend Engineer",
            jdText="Python FastAPI PostgreSQL Redis 기반 API 설계와 운영 경험 우대",
        ),
        documents=CoverLetterDocumentsInput(
            coverLetterText=(
                "[문항 1] 저는 FastAPI API 설계와 PostgreSQL 성능 개선을 담당했습니다. "
                "Redis 캐시를 적용해 조회 응답을 개선했고 장애 로그를 분석했습니다."
            ),
            resumeText="FastAPI, PostgreSQL, Redis 기반 백엔드 프로젝트 담당",
            portfolioText="API 아키텍처와 캐시 키 설계 문서",
        ),
    )


def test_rag_chunk_constants_and_chunk_boundaries():
    text = "[문항 1] " + "FastAPI PostgreSQL Redis 성능 개선 경험. " * 40

    chunks = chunk_text("coverLetter", text)

    assert CHUNK_MAX_CHARS == 420
    assert CHUNK_OVERLAP_CHARS == 100
    assert len(chunks) >= 2
    assert all(len(chunk.text) <= CHUNK_MAX_CHARS + CHUNK_OVERLAP_CHARS for chunk in chunks)
    assert all(chunk.source == "coverLetter" for chunk in chunks)


def test_cover_letter_agent_prompts_contain_guardrails():
    assert "retrievedEvidence" in OPENAI_EVALUATOR_PROMPT
    assert "입력으로 들어온 JD와 문서에 실제로 있는 근거만 사용" in OPENAI_EVALUATOR_PROMPT
    assert "점수를 새로 만들지 말고" in OPENAI_EVALUATOR_PROMPT
    assert "붙어서 봐야 하는 표현은 쪼개지 마라" in OPENAI_JD_ANALYZER_PROMPT
    assert "숫자 점수는 절대 만들지 마라" in OPENAI_EVIDENCE_JUDGE_PROMPT
    assert "새 경험을 만들지 마라" in OPENAI_DRAFT_PROMPT
    assert "입력 근거에 없는 새 경험" in OPENAI_REVIEW_PROMPT


def test_jd_analyzer_uses_llm_requirements_without_splitting_compound_terms(monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(
        jd_analyzer_agent,
        "request_openai_json",
        lambda *_args, **_kwargs: {
            "requirements": [
                {
                    "id": "REQ_1",
                    "name": "Forward Deployed Engineer 역할 이해",
                    "category": "직무 적합도",
                    "priority": "high",
                    "maxScore": 20,
                    "evidenceNeeded": "산업 현장 문제를 기술적으로 정의하고 해결한 경험",
                    "sourceText": "Forward Deployed Engineer",
                    "keywords": ["Forward Deployed Engineer"],
                },
                {
                    "id": "REQ_2",
                    "name": "RAG 및 Fine tuning 활용 경험",
                    "category": "기술 역량",
                    "priority": "high",
                    "maxScore": 20,
                    "evidenceNeeded": "RAG 또는 Fine tuning을 활용한 LLM 개선 경험",
                    "sourceText": "RAG 및 Fine tuning 기법을 활용",
                    "keywords": ["RAG", "Fine tuning"],
                },
                {
                    "id": "REQ_3",
                    "name": "Python 개발 역량",
                    "category": "기술 역량",
                    "priority": "medium",
                    "maxScore": 15,
                    "evidenceNeeded": "Python으로 실제 기능을 구현한 경험",
                    "sourceText": "Python 프로그래밍에 능숙",
                    "keywords": ["Python"],
                },
            ]
        },
    )
    payload = CoverLetterFeedbackRequest(
        userId="user-jd",
        jobAnalysis=CoverLetterJobAnalysisInput(
            companyName="MakinaRocks",
            positionName="Forward Deployed Engineer - LLM",
            jdText=(
                "Forward Deployed Engineer는 산업 현장 문제를 해결합니다. "
                "RAG 및 Fine tuning 기법을 활용하며 Python 프로그래밍에 능숙해야 합니다."
            ),
        ),
        documents=CoverLetterDocumentsInput(coverLetterText=""),
    )

    jd_context = run_jd_analyzer_agent(payload)

    assert jd_context["requirementSource"] == "OPENAI_REQUIREMENTS"
    assert jd_context["requirements"][0]["keywords"] == ["Forward Deployed Engineer"]
    assert "Fine tuning" in jd_context["requirements"][1]["keywords"]


def test_no_cost_cover_letter_graph_path_uses_local_fallback(monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_API_KEY", None)
    payload = _cover_letter_payload()

    jd_context = run_jd_analyzer_agent(payload)
    rag_context = run_rag_retriever_agent(payload, jd_context)
    evidence_context = run_evidence_extractor_agent(payload, jd_context, rag_context)
    evaluation = run_cover_letter_evaluator_agent(payload, jd_context, evidence_context)
    validation = run_cover_letter_evaluation_validator_agent(
        evaluation,
        jd_context,
        evidence_context,
    )

    assert rag_context["chunkCount"] >= 3
    assert len(rag_context["retrievedEvidence"]) >= 1
    assert evaluation["source"] == "HEURISTIC"
    assert evaluation["retrievedEvidence"] == rag_context["retrievedEvidence"]
    assert validation.valid is True
    assert validation.retryCount == 0


def test_cover_letter_evaluation_validator_rejects_overconfident_unverified_score(monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_API_KEY", None)
    payload = _cover_letter_payload()
    jd_context = run_jd_analyzer_agent(payload)
    rag_context = run_rag_retriever_agent(payload, jd_context)
    evidence_context = run_evidence_extractor_agent(payload, jd_context, rag_context)
    evaluation = run_cover_letter_evaluator_agent(payload, jd_context, evidence_context)

    for rubric_score in evaluation["rubricScores"]:
        rubric_score.verified = False
        rubric_score.score = rubric_score.maxScore
    evaluation["totalScore"] = 88

    validation = run_cover_letter_evaluation_validator_agent(
        evaluation,
        jd_context,
        evidence_context,
    )

    assert validation.valid is False
    assert validation.retryInstruction


def test_cover_letter_evaluator_uses_server_scores_over_openai_numbers(monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_API_KEY", None)
    payload = _cover_letter_payload()
    jd_context = run_jd_analyzer_agent(payload)
    rag_context = run_rag_retriever_agent(payload, jd_context)
    evidence_context = run_evidence_extractor_agent(payload, jd_context, rag_context)
    server_evaluation = run_cover_letter_evaluator_agent(
        payload,
        jd_context,
        evidence_context,
    )

    monkeypatch.setattr(settings, "OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(
        cover_letter_evaluator_agent,
        "request_openai_json",
        lambda *_args, **_kwargs: {
            "jdAlignmentScore": 35,
            "jobFitScore": 95,
            "totalScore": 45,
            "summary": "테스트 평가",
            "strengths": ["강점"],
            "weaknesses": ["약점"],
            "revisionDirections": ["수정"],
            "nextActions": ["다음"],
            "rubricScores": [
                {
                    "category": "JD 반영도",
                    "score": 22,
                    "maxScore": 25,
                    "evidenceText": "Python FastAPI PostgreSQL Redis",
                    "evidenceSource": "JD",
                },
                {
                    "category": "직무 적합도",
                    "score": 21,
                    "maxScore": 25,
                    "evidenceText": "FastAPI, PostgreSQL, Redis 기반 백엔드 프로젝트 담당",
                    "evidenceSource": "resume",
                },
                {
                    "category": "경험 구체성",
                    "score": 16,
                    "maxScore": 20,
                    "evidenceText": "FastAPI API 설계와 PostgreSQL 성능 개선을 담당했습니다.",
                    "evidenceSource": "coverLetter",
                },
                {
                    "category": "성과/근거",
                    "score": 12,
                    "maxScore": 15,
                    "evidenceText": "Redis 캐시를 적용해 조회 응답을 개선했고 장애 로그를 분석했습니다.",
                    "evidenceSource": "coverLetter",
                },
                {
                    "category": "문항 적합성",
                    "score": 8,
                    "maxScore": 10,
                    "evidenceText": "FastAPI API 설계와 PostgreSQL 성능 개선",
                    "evidenceSource": "coverLetter",
                },
                {
                    "category": "문장 완성도",
                    "score": 4,
                    "maxScore": 5,
                    "evidenceText": "API 아키텍처와 캐시 키 설계 문서",
                    "evidenceSource": "portfolio",
                },
            ],
            "questionScores": [
                {
                    "questionNumber": 1,
                    "title": "전체 자소서",
                    "score": 88,
                    "feedback": "JD와 연결됩니다.",
                }
            ],
        },
    )

    evaluation = run_cover_letter_evaluator_agent(payload, jd_context, evidence_context)

    assert evaluation["source"] == "HEURISTIC+OPENAI_TEXT"
    assert evaluation["totalScore"] == server_evaluation["totalScore"]
    assert evaluation["jdAlignmentScore"] == server_evaluation["jdAlignmentScore"]
    assert evaluation["jobFitScore"] == server_evaluation["jobFitScore"]
    assert evaluation["confidence"] == server_evaluation["confidence"]
    assert evaluation["summary"] == "테스트 평가"
    assert [
        (item.category, item.score, item.maxScore, item.verified)
        for item in evaluation["rubricScores"]
    ] == [
        (item.category, item.score, item.maxScore, item.verified)
        for item in server_evaluation["rubricScores"]
    ]
    assert [
        (item.questionNumber, item.score)
        for item in evaluation["questionScores"]
    ] == [
        (item.questionNumber, item.score)
        for item in server_evaluation["questionScores"]
    ]


def test_cover_letter_evaluator_is_stable_across_openai_rubric_variants(monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "test-key")
    payload = _cover_letter_payload()
    jd_context = run_jd_analyzer_agent(payload)
    rag_context = run_rag_retriever_agent(payload, jd_context)
    evidence_context = run_evidence_extractor_agent(payload, jd_context, rag_context)

    low_openai_result = {
        "totalScore": 45,
        "jdAlignmentScore": 88,
        "jobFitScore": 35,
        "summary": "낮은 평가",
        "strengths": ["강점"],
        "weaknesses": ["약점"],
        "revisionDirections": ["수정"],
        "nextActions": ["다음"],
        "rubricScores": [
            {
                "category": "JD 반영도",
                "score": 22,
                "maxScore": 25,
                "evidenceText": "Python FastAPI",
                "evidenceSource": "JD",
            },
            {
                "category": "직무 적합도",
                "score": 8,
                "maxScore": 25,
                "evidenceText": "",
                "evidenceSource": "coverLetter",
            },
        ],
    }
    high_openai_result = {
        "totalScore": 95,
        "jdAlignmentScore": 95,
        "jobFitScore": 95,
        "summary": "높은 평가",
        "strengths": ["강점"],
        "weaknesses": ["약점"],
        "revisionDirections": ["수정"],
        "nextActions": ["다음"],
        "rubricScores": [
            {
                "category": "JD 반영도",
                "score": 25,
                "maxScore": 25,
                "evidenceText": "Python FastAPI PostgreSQL Redis",
                "evidenceSource": "JD",
            },
            {
                "category": "직무 적합도",
                "score": 25,
                "maxScore": 25,
                "evidenceText": "FastAPI, PostgreSQL, Redis 기반 백엔드 프로젝트 담당",
                "evidenceSource": "resume",
            },
        ],
    }

    monkeypatch.setattr(
        cover_letter_evaluator_agent,
        "request_openai_json",
        lambda *_args, **_kwargs: low_openai_result,
    )
    low_evaluation = run_cover_letter_evaluator_agent(
        payload,
        jd_context,
        evidence_context,
    )

    monkeypatch.setattr(
        cover_letter_evaluator_agent,
        "request_openai_json",
        lambda *_args, **_kwargs: high_openai_result,
    )
    high_evaluation = run_cover_letter_evaluator_agent(
        payload,
        jd_context,
        evidence_context,
    )

    assert low_evaluation["totalScore"] == high_evaluation["totalScore"]
    assert low_evaluation["jdAlignmentScore"] == high_evaluation["jdAlignmentScore"]
    assert low_evaluation["jobFitScore"] == high_evaluation["jobFitScore"]
    assert low_evaluation["confidence"] == high_evaluation["confidence"]
    assert [
        (item.category, item.score, item.maxScore, item.verified)
        for item in low_evaluation["rubricScores"]
    ] == [
        (item.category, item.score, item.maxScore, item.verified)
        for item in high_evaluation["rubricScores"]
    ]


def test_cover_letter_evidence_judge_does_not_accept_fake_evidence(monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_API_KEY", None)
    payload = _cover_letter_payload()
    jd_context = run_jd_analyzer_agent(payload)
    jd_context["requirements"] = [
        {
            "id": "REQ_1",
            "name": "Python FastAPI 개발 역량",
            "category": "기술 역량",
            "priority": "high",
            "maxScore": 20,
            "evidenceNeeded": "Python과 FastAPI로 실제 기능을 구현한 경험",
            "sourceText": "Python FastAPI",
            "keywords": ["Python", "FastAPI"],
        },
        {
            "id": "REQ_2",
            "name": "Fine tuning 운영 경험",
            "category": "기술 역량",
            "priority": "high",
            "maxScore": 20,
            "evidenceNeeded": "Fine tuning을 실제 운영에 적용한 경험",
            "sourceText": "Fine tuning",
            "keywords": ["Fine tuning"],
        },
    ]
    rag_context = run_rag_retriever_agent(payload, jd_context)
    evidence_context = run_evidence_extractor_agent(payload, jd_context, rag_context)

    monkeypatch.setattr(settings, "OPENAI_API_KEY", "test-key")

    def fake_request_openai_json(system_prompt, *_args, **_kwargs):
        if system_prompt == OPENAI_EVIDENCE_JUDGE_PROMPT:
            return {
                "requirementEvaluations": [
                    {
                        "requirementId": "REQ_1",
                        "evidenceStrength": "strong",
                        "evidenceText": "저는 FastAPI API 설계와 PostgreSQL 성능 개선을 담당했습니다.",
                        "evidenceSource": "coverLetter",
                        "reason": "실제 개발 경험이 확인됩니다.",
                    },
                    {
                        "requirementId": "REQ_2",
                        "evidenceStrength": "strong",
                        "evidenceText": "Fine tuning 운영으로 모델 성능을 30% 개선했습니다.",
                        "evidenceSource": "coverLetter",
                        "reason": "가짜 근거입니다.",
                    },
                ]
            }
        return {
            "summary": "테스트 평가",
            "strengths": ["강점"],
            "weaknesses": ["약점"],
            "revisionDirections": ["수정"],
            "nextActions": ["다음"],
        }

    monkeypatch.setattr(
        cover_letter_evaluator_agent,
        "request_openai_json",
        fake_request_openai_json,
    )

    evaluation = run_cover_letter_evaluator_agent(payload, jd_context, evidence_context)
    requirement_by_id = {
        item["requirementId"]: item
        for item in evaluation["requirementEvaluations"]
    }

    assert evaluation["source"] == "OPENAI_REQUIREMENT_JUDGE+OPENAI_TEXT"
    assert requirement_by_id["REQ_1"]["evidenceStrength"] == "strong"
    assert requirement_by_id["REQ_1"]["verified"] is True
    assert requirement_by_id["REQ_2"]["evidenceStrength"] == "none"
    assert requirement_by_id["REQ_2"]["verified"] is False
    assert evaluation["totalScore"] == sum(
        item.score for item in evaluation["rubricScores"]
    )


def test_cover_letter_validator_rejects_top_score_and_rubric_mismatch(monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_API_KEY", None)
    payload = _cover_letter_payload()
    jd_context = run_jd_analyzer_agent(payload)
    rag_context = run_rag_retriever_agent(payload, jd_context)
    evidence_context = run_evidence_extractor_agent(payload, jd_context, rag_context)
    evaluation = run_cover_letter_evaluator_agent(payload, jd_context, evidence_context)

    evaluation["rubricScores"][0].score = 22
    evaluation["jdAlignmentScore"] = 35

    validation = run_cover_letter_evaluation_validator_agent(
        evaluation,
        jd_context,
        evidence_context,
    )

    assert validation.valid is False
    assert any("JD 반영도" in reason for reason in validation.reasons)


def test_interview_rag_evidence_does_not_replace_answer_score(monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_API_KEY", None)
    collection_id = build_interview_rag_collection(
        session_id="ivs-no-cost",
        company_name="OpenAI Korea",
        position_name="Backend Engineer",
        jd_text="FastAPI PostgreSQL Redis 기반 API 운영",
        documents=InterviewDocumentsInput(
            coverLetterText="Redis 캐시와 PostgreSQL 성능 개선 경험",
        ),
    )
    evidence = retrieve_interview_evidence(
        collection_id,
        "FastAPI PostgreSQL Redis 성능 개선",
        limit=5,
    )
    weak_answer = evaluate_interview_answer(
        question_type="JD_FIT",
        question_text="FastAPI 운영 경험을 설명해 주세요.",
        answer_text="열심히 했습니다.",
        jd_text="FastAPI PostgreSQL Redis 기반 API 운영",
        position_name="Backend Engineer",
        retrieved_evidence=evidence,
    )

    assert evidence
    assert weak_answer["isSufficient"] is False
    assert weak_answer["scores"]["totalContentScore"] < 70


def test_interview_evaluation_validator_rejects_answer_missing_claimed_result(monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_API_KEY", None)
    evaluation = evaluate_interview_answer(
        question_type="JD_FIT",
        question_text="FastAPI 운영 경험을 설명해 주세요.",
        answer_text="프로젝트를 했습니다. 열심히 했습니다.",
        jd_text="FastAPI PostgreSQL Redis 기반 API 운영",
        position_name="Backend Engineer",
    )
    evaluation["scores"]["evidenceResult"] = 14
    evaluation["scores"]["totalContentScore"] = sum(
        int(evaluation["scores"][key])
        for key in [
            "questionRelevance",
            "specificity",
            "evidenceResult",
            "jobFit",
            "logicStructure",
            "authenticityAttitude",
        ]
    )

    validation = validate_interview_evaluation(
        evaluation=evaluation,
        question_text="FastAPI 운영 경험을 설명해 주세요.",
        answer_text="프로젝트를 했습니다. 열심히 했습니다.",
        jd_text="FastAPI PostgreSQL Redis 기반 API 운영",
    )

    assert validation.valid is False
    assert validation.retryInstruction

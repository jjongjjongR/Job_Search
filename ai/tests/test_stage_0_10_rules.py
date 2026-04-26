from app.core.config import settings
from app.schemas.jobs import JobAnalyzeRequest
from app.schemas.common import DocumentSufficiency
from app.schemas.interview import InterviewDocumentsInput
from app.services.interview.answer_evaluator import evaluate_interview_answer
from app.services.interview.question_planner import build_question_plan
from app.services.jobs.analyze_service import analyze_job_service


def test_job_analyze_manual_path_accepts_job_posting_url_alias(monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_API_KEY", None)

    response = analyze_job_service(
        JobAnalyzeRequest(
            jobPostingUrl="https://example.com/jobs/backend-engineer",
            manualCompanyName="OpenAI Korea",
            manualJobTitle="Backend Engineer",
            manualJdText="백엔드 서비스 개발 운영, Python FastAPI PostgreSQL 경험 우대",
        )
    )

    assert response.companyName == "OpenAI Korea"
    assert response.positionName == "Backend Engineer"
    assert response.sourceType == "JOB_POSTING_URL"
    assert "Python" in response.extractedSkills


def test_question_plan_builds_ten_questions_for_jd_only():
    plan = build_question_plan(
        company_name="OpenAI Korea",
        position_name="Backend Engineer",
        jd_text="백엔드 서비스 개발 운영 최적화, Python, FastAPI, PostgreSQL 경험 우대",
        documents=InterviewDocumentsInput(),
        document_sufficiency=DocumentSufficiency.JD_ONLY,
    )

    assert len(plan) == 10
    assert plan[0]["questionText"] == "1분 자기소개 부탁드립니다."
    assert "가장 자신 있는 경험이나 학습 과정" in str(plan[4]["questionText"])


def test_interview_answer_evaluation_fallback_builds_scores_and_insufficiency(monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_API_KEY", None)

    evaluation = evaluate_interview_answer(
        question_type="JD_FIT",
        question_text="이 직무에서 중요한 Python 역량과 가장 잘 맞는 본인 경험은 무엇인가요?",
        answer_text="프로젝트를 했습니다. 열심히 했습니다.",
        jd_text="Python FastAPI PostgreSQL 기반 백엔드 서비스 개발",
        position_name="Backend Engineer",
    )

    assert set(evaluation["scores"].keys()) == {
        "questionRelevance",
        "specificity",
        "evidenceResult",
        "jobFit",
        "logicStructure",
        "authenticityAttitude",
        "totalContentScore",
    }
    assert evaluation["isSufficient"] is False
    assert evaluation["followUpFocus"] is not None
    assert len(evaluation["insufficiencyReasons"]) >= 1

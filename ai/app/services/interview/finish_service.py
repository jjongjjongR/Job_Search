from collections import Counter
from datetime import datetime, timezone
import json

import httpx

from app.core.config import settings
from app.adapters.redis_state_store import redis_interview_state_store
from app.schemas.common import InterviewSessionStatus
from app.schemas.interview import (
    FinalReport,
    FinalQuestionAnswerItem,
    FinalTurnFeedbackItem,
    InterviewFinishRequest,
    InterviewFinishResponse,
)

OPENAI_TIMEOUT_SECONDS = 20.0


# 2026.04.25 신규: 13단계 최종 리포트 생성을 위해 hidden score를 집계해 종료 응답을 만든다
async def interview_finish_service(
    payload: InterviewFinishRequest,
) -> InterviewFinishResponse:
    session_state = (
        await redis_interview_state_store.get_session_state(payload.sessionId) or {}
    )
    hidden_scores = await redis_interview_state_store.list_hidden_scores(payload.sessionId)
    finished_at = datetime.now(timezone.utc).isoformat()
    final_report = _build_final_report(session_state, hidden_scores)
    # 2026-04-29 신규: 5문항 미만 종료는 기준사항에 따라 리포트 없이 취소 상태로 마감
    status = (
        InterviewSessionStatus.FINISHED
        if len(hidden_scores) >= 5
        else InterviewSessionStatus.CANCELLED
    )

    response = InterviewFinishResponse(
        status=status,
        finishedAt=finished_at,
        finalReport=final_report,
    )

    # 2026.04.10 신규: 세션 종료 시 cleanup deadline key를 기록
    await redis_interview_state_store.schedule_cleanup(
        session_id=payload.sessionId,
        ttl_seconds=600,
    )
    await redis_interview_state_store.save_session_state(
        session_id=payload.sessionId,
        payload={
            "status": response.status,
            "finishedAt": response.finishedAt,
            "cleanupScheduled": True,
            "currentQuestionNumber": session_state.get("currentQuestionNumber", 1),
            "followUpCountForCurrentQuestion": session_state.get(
                "followUpCountForCurrentQuestion", 0
            ),
            "currentPlanIndex": session_state.get("currentPlanIndex", 0),
            "totalQuestionCount": session_state.get("totalQuestionCount", 10),
            "plannedQuestions": session_state.get("plannedQuestions", []),
            "companyName": session_state.get("companyName"),
            "positionName": session_state.get("positionName"),
            "jdText": session_state.get("jdText"),
            "documents": session_state.get("documents", {}),
            # 2026-05-07 신규: cleanup 시 면접 RAG collection도 삭제할 수 있게 식별자 유지
            "interviewRagCollectionId": session_state.get("interviewRagCollectionId"),
            # 2026-04-29 신규: cleanup 시 임시 업로드 답변 영상 삭제 대상을 유지
            "tempVideoStorageKeys": session_state.get("tempVideoStorageKeys", []),
            "finalReport": final_report.model_dump(),
        },
    )

    return response


# 2026.04.25 신규: 13단계 기준 총점/요약/강점/보완점/연습 방향 3개를 Redis hidden score 기준으로 계산
def _build_final_report(
    session_state: dict[str, object],
    hidden_scores: list[dict[str, object]],
) -> FinalReport:
    # 2026-04-29 수정: 5문항 미만은 기준사항에 따라 평가 리포트를 생성하지 않는다
    if len(hidden_scores) < 5:
        return FinalReport(
            totalScore=0,
            grade="리포트 미생성",
            summary="실제 진행 문항 수가 5문항 미만이라 기준사항에 따라 최종 평가는 생성하지 않았습니다.",
            strengths=[
                "최종 리포트 생성 기준 문항 수에 도달하지 않았습니다.",
                "부분 답변은 평가 결과로 확정하지 않았습니다.",
                "임시 분석 데이터는 cleanup 정책에 따라 삭제됩니다.",
            ],
            weaknesses=[
                "5문항 이상 진행해야 최종 점수를 계산할 수 있습니다.",
                "질문-답변 누적량이 부족해 강점과 보완점을 확정할 수 없습니다.",
                "면접 흐름을 다시 시작해 충분한 답변 수를 확보해야 합니다.",
            ],
            practiceDirections=[
                "다음 세션에서는 최소 5문항 이상 답변한 뒤 종료해 보세요.",
                "답변이 막히면 텍스트 fallback을 사용해 흐름을 이어가 보세요.",
                "1분 자기소개부터 직무 연결 문장을 짧게 준비해 보세요.",
            ],
            questionAnswers=[],
            turnFeedbacks=[],
        )

    total_scores = [int(item.get("totalScore", 0)) for item in hidden_scores]
    content_scores = [int(item.get("contentScore", 0)) for item in hidden_scores]
    nonverbal_scores = [int(item.get("nonverbalScore", 0)) for item in hidden_scores]
    sufficient_count = sum(1 for item in hidden_scores if bool(item.get("isSufficient")))
    total_score = round(sum(total_scores) / len(total_scores))
    average_content = round(sum(content_scores) / len(content_scores))
    average_nonverbal = round(sum(nonverbal_scores) / len(nonverbal_scores))
    insufficiency_counter = _count_insufficiency_reasons(hidden_scores)

    base_report = FinalReport(
        totalScore=max(0, min(total_score, 100)),
        grade=_build_grade(total_score),
        summary=_build_summary(
            total_score=total_score,
            average_content=average_content,
            average_nonverbal=average_nonverbal,
            sufficient_count=sufficient_count,
            turn_count=len(hidden_scores),
            most_common_reason=(
                insufficiency_counter.most_common(1)[0][0]
                if insufficiency_counter
                else None
            ),
            company_name=str(session_state.get("companyName") or "").strip(),
            position_name=str(session_state.get("positionName") or "").strip(),
        ),
        strengths=_build_strengths(
            average_content=average_content,
            average_nonverbal=average_nonverbal,
            sufficient_count=sufficient_count,
            turn_count=len(hidden_scores),
        ),
        weaknesses=_build_weaknesses(insufficiency_counter),
        practiceDirections=_build_practice_directions(insufficiency_counter),
        questionAnswers=_build_question_answers(hidden_scores),
        turnFeedbacks=_build_turn_feedbacks(hidden_scores),
    )
    # 2026-05-06 신규: 누적 질문/답변/점수를 읽는 LLM report_generator agent 결과를 서버 검증 후 반영
    llm_report = _request_openai_final_report(
        session_state=session_state,
        hidden_scores=hidden_scores,
        base_report=base_report,
    )
    return llm_report or base_report


def _build_grade(total_score: int) -> str:
    if total_score >= 90:
        return "매우 우수"
    if total_score >= 80:
        return "우수"
    if total_score >= 70:
        return "보통"
    if total_score >= 60:
        return "보완 필요"
    return "집중 보완 필요"


def _build_summary(
    total_score: int,
    average_content: int,
    average_nonverbal: int,
    sufficient_count: int,
    turn_count: int,
    most_common_reason: str | None,
    company_name: str,
    position_name: str,
) -> str:
    target = " / ".join(part for part in [company_name, position_name] if part).strip()
    target_prefix = f"{target} 기준으로 보면 " if target else "전체 면접 흐름 기준으로 보면 "
    stability_text = (
        "충분 답변 비율이 비교적 높아 흐름이 안정적입니다."
        if sufficient_count >= max(1, turn_count // 2)
        else "답변별 편차가 있어 일부 질문에서는 보완이 필요합니다."
    )
    weakness_text = (
        f"특히 {most_common_reason}"
        if most_common_reason
        else "특정 보완 포인트는 다음 연습 방향을 참고하면 좋습니다."
    )
    return (
        f"{target_prefix}최종 점수는 {max(0, min(total_score, 100))}점이며, "
        f"내용 평균은 {average_content}/85점, 비언어 평균은 {average_nonverbal}/15점입니다. "
        f"{stability_text} {weakness_text}"
    )


def _build_strengths(
    average_content: int,
    average_nonverbal: int,
    sufficient_count: int,
    turn_count: int,
) -> list[str]:
    strengths: list[str] = []
    if average_content >= 70:
        strengths.append("질문 의도에 맞는 내용 전달이 전반적으로 안정적입니다.")
    if average_nonverbal >= 8:
        strengths.append("비언어 전달이 비교적 안정적으로 유지되었습니다.")
    if sufficient_count >= max(1, turn_count // 2):
        strengths.append("기본 질문 흐름에서 충분 답변 비율이 비교적 높았습니다.")
    defaults = [
        "답변 분량과 경험 설명의 기본 뼈대가 갖춰져 있습니다.",
        "질문 흐름을 따라가며 면접을 끝까지 진행한 점이 좋습니다.",
        "직무 경험을 답변 안에 녹여내려는 시도가 보였습니다.",
    ]
    for item in defaults:
        if len(strengths) >= 3:
            break
        if item not in strengths:
            strengths.append(item)
    return strengths[:3]


def _build_weaknesses(counter: Counter[str]) -> list[str]:
    mapped: list[str] = []
    for reason, _ in counter.most_common():
        normalized = _normalize_reason(reason)
        if normalized not in mapped:
            mapped.append(normalized)
        if len(mapped) >= 3:
            break

    defaults = [
        "본인 역할과 기여도를 더 선명하게 설명할 필요가 있습니다.",
        "성과와 근거를 더 구체적으로 말할 필요가 있습니다.",
        "직무 연결 문장을 더 분명하게 정리할 필요가 있습니다.",
    ]
    for item in defaults:
        if len(mapped) >= 3:
            break
        if item not in mapped:
            mapped.append(item)
    return mapped[:3]


def _build_practice_directions(counter: Counter[str]) -> list[str]:
    directions: list[str] = []
    for reason, _ in counter.most_common():
        mapped = _map_reason_to_practice(reason)
        if mapped not in directions:
            directions.append(mapped)
        if len(directions) >= 3:
            break

    defaults = [
        "답변 첫 문장에서 역할과 상황을 먼저 정리해 보세요.",
        "성과는 숫자나 비교 결과로 한 번 더 구체화해 보세요.",
        "문단 마지막을 지원 직무와의 연결 문장으로 마무리해 보세요.",
    ]
    for item in defaults:
        if len(directions) >= 3:
            break
        if item not in directions:
            directions.append(item)
    return directions[:3]


def _count_insufficiency_reasons(
    hidden_scores: list[dict[str, object]],
) -> Counter[str]:
    counter: Counter[str] = Counter()
    for item in hidden_scores:
        reasons = item.get("insufficiencyReasons", [])
        if isinstance(reasons, list):
            for reason in reasons:
                normalized = str(reason).strip()
                if normalized:
                    counter[normalized] += 1
    return counter


# 2026-05-06 신규: 최종 리포트에 질문-답변 복기 목록을 포함
def _build_question_answers(
    hidden_scores: list[dict[str, object]],
) -> list[FinalQuestionAnswerItem]:
    items: list[FinalQuestionAnswerItem] = []
    for index, score in enumerate(hidden_scores, start=1):
        question_text = str(score.get("questionText") or "").strip()
        answer_full_text = str(score.get("answerFullText") or "").strip()
        if not question_text or not answer_full_text:
            continue
        items.append(
            FinalQuestionAnswerItem(
                turnNumber=int(score.get("turnNumber") or index),
                questionText=question_text,
                answerFullText=answer_full_text,
            )
        )
    return items


# 2026-05-06 신규: 최종 리포트에 턴별 피드백 목록을 포함
def _build_turn_feedbacks(
    hidden_scores: list[dict[str, object]],
) -> list[FinalTurnFeedbackItem]:
    items: list[FinalTurnFeedbackItem] = []
    for index, score in enumerate(hidden_scores, start=1):
        question_text = str(score.get("questionText") or "").strip()
        feedback_text = str(score.get("feedbackText") or "").strip()
        nonverbal_summary_text = str(score.get("nonverbalSummaryText") or "").strip()
        if not question_text or not feedback_text:
            continue
        items.append(
            FinalTurnFeedbackItem(
                turnNumber=int(score.get("turnNumber") or index),
                questionText=question_text,
                feedbackText=feedback_text,
                nonverbalSummaryText=nonverbal_summary_text,
            )
        )
    return items


# 2026-05-06 신규: 누적 면접 흐름을 읽어 강점/보완점/연습 방향을 생성하는 LLM 리포트 agent
def _request_openai_final_report(
    session_state: dict[str, object],
    hidden_scores: list[dict[str, object]],
    base_report: FinalReport,
) -> FinalReport | None:
    if not settings.OPENAI_API_KEY:
        return None

    system_prompt = """
너는 면접 최종 리포트를 작성하는 report_generator agent다.
JSON만 반환한다.

규칙:
1. 총점과 등급은 서버가 계산한 값을 그대로 사용한다.
2. 질문/답변/피드백/점수 근거 안에서만 강점과 보완점을 작성한다.
3. JD의 직무상세, 지원자격, 우대사항, retrievedEvidence와 답변 연결도를 중심으로 평가한다.
4. 없는 경험이나 성과를 만들어내지 않는다.
5. summary는 2~3문장, strengths/weaknesses/practiceDirections는 각각 3개로 작성한다.

반환 형식:
{
  "summary": "문자열",
  "strengths": ["문자열", "문자열", "문자열"],
  "weaknesses": ["문자열", "문자열", "문자열"],
  "practiceDirections": ["문자열", "문자열", "문자열"]
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
                        "companyName": session_state.get("companyName"),
                        "positionName": session_state.get("positionName"),
                        "jdText": str(session_state.get("jdText") or "")[:5000],
                        "baseReport": base_report.model_dump(),
                        # 2026-05-06 신규: 리포트 생성 agent에는 질문/답변/피드백 핵심 범위만 전달
                        "turns": [
                            {
                                **score,
                                "answerFullText": str(score.get("answerFullText") or "")[:1200],
                                "feedbackText": str(score.get("feedbackText") or "")[:500],
                            }
                            for score in hidden_scores
                        ],
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
        summary = str(parsed.get("summary") or "").strip()
        strengths = _normalize_report_list(parsed.get("strengths"))
        weaknesses = _normalize_report_list(parsed.get("weaknesses"))
        practice_directions = _normalize_report_list(parsed.get("practiceDirections"))
        if not summary or len(strengths) != 3 or len(weaknesses) != 3 or len(practice_directions) != 3:
            return None
        return base_report.model_copy(
            update={
                "summary": summary,
                "strengths": strengths,
                "weaknesses": weaknesses,
                "practiceDirections": practice_directions,
            }
        )
    except Exception:
        return None


# 2026-05-06 신규: LLM 리포트 배열 결과를 서버 계약에 맞게 3개 문자열로 검증
def _normalize_report_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    normalized = [str(item).strip() for item in value if str(item).strip()]
    return normalized[:3]


def _normalize_reason(reason: str) -> str:
    if "역할" in reason or "기여" in reason:
        return "본인 역할과 기여도를 더 선명하게 설명할 필요가 있습니다."
    if "성과" in reason or "근거" in reason:
        return "성과와 근거를 더 구체적으로 말할 필요가 있습니다."
    if "직무" in reason:
        return "직무 연결 문장을 더 분명하게 정리할 필요가 있습니다."
    if "구체" in reason or "과정" in reason:
        return "과정 설명을 더 구체적으로 말할 필요가 있습니다."
    if "협업" in reason or "소통" in reason:
        return "협업 과정과 소통 방식을 더 또렷하게 설명할 필요가 있습니다."
    return reason


def _map_reason_to_practice(reason: str) -> str:
    if "역할" in reason or "기여" in reason:
        return "답변 첫 문장에서 맡은 역할과 책임 범위를 먼저 말해 보세요."
    if "성과" in reason or "근거" in reason:
        return "성과는 숫자, 비교 결과, 개선 폭으로 한 번 더 정리해 보세요."
    if "직무" in reason:
        return "경험 설명 마지막을 지원 직무와의 연결 문장으로 마무리해 보세요."
    if "구체" in reason or "과정" in reason:
        return "문제 상황, 해결 방법, 결과 순서로 답변 구조를 다시 잡아 보세요."
    if "협업" in reason or "소통" in reason:
        return "협업 상황에서는 상대와 어떻게 조율했는지 한 문장 더 추가해 보세요."
    return "답변을 STAR 구조로 다시 정리해 부족한 부분을 보완해 보세요."

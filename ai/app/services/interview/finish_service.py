from collections import Counter
from datetime import datetime, timezone

from app.adapters.redis_state_store import redis_interview_state_store
from app.schemas.common import InterviewSessionStatus
from app.schemas.interview import (
    FinalReport,
    InterviewFinishRequest,
    InterviewFinishResponse,
)


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

    response = InterviewFinishResponse(
        status=InterviewSessionStatus.FINISHED,
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
            "finalReport": final_report.model_dump(),
        },
    )

    return response


# 2026.04.25 신규: 13단계 기준 총점/요약/강점/보완점/연습 방향 3개를 Redis hidden score 기준으로 계산
def _build_final_report(
    session_state: dict[str, object],
    hidden_scores: list[dict[str, object]],
) -> FinalReport:
    if not hidden_scores:
        return FinalReport(
            totalScore=0,
            grade="집중 보완 필요",
            summary="아직 저장된 답변 평가가 없어 최종 리포트를 생성하지 못했습니다.",
            strengths=[
                "면접 세션 시작은 정상적으로 완료되었습니다.",
                "이후 답변이 누적되면 실제 평가 요약을 생성할 수 있습니다.",
                "현재 단계에서는 종료 흐름과 저장 구조를 먼저 마감했습니다.",
            ],
            weaknesses=[
                "저장된 답변 턴이 없습니다.",
                "내용 점수 집계가 아직 불가능합니다.",
                "비언어 보조 평가 집계도 아직 없습니다.",
            ],
            practiceDirections=[
                "최소 1개 이상 답변을 제출한 뒤 다시 종료해 보세요.",
                "질문 의도에 맞는 답변을 먼저 충분히 남겨 보세요.",
                "필요하면 텍스트 답변으로라도 세션을 이어가 보세요.",
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

    return FinalReport(
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
        questionAnswers=[],
        turnFeedbacks=[],
    )


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

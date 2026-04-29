# ai/app/services/interview/vision_service.py

from pathlib import Path

from app.core.config import settings
from app.schemas.common import VisionResultStatus
from app.schemas.interview import InterviewAnswerRequest
from app.services.vision.mediapipe_backend import MediaPipeVisionBackend


# 2026-04-21 신규: 12단계 규칙에 맞춘 최소 Vision 보조 평가
def evaluate_vision_metrics(payload: InterviewAnswerRequest) -> dict[str, object]:
    if payload.answerType == "TEXT":
        return {
            "status": VisionResultStatus.SKIPPED,
            "score": 0,
            "summary": "텍스트 답변으로 전환되어 비언어 평가는 반영하지 않았습니다.",
            "metrics": {
                "faceDetectedRatio": None,
                "multiFaceDetected": None,
                "lowLight": None,
                "obstructionDetected": None,
                "gazeStable": None,
            },
        }

    # 2026-04-29 신규: 영상 storage key가 있으면 MediaPipe backend로 실제 Vision 지표를 계산
    if payload.answerVideoStorageKey:
        cleaned_key = payload.answerVideoStorageKey.strip().lstrip("/").replace("\\", "/")
        if cleaned_key and ".." not in cleaned_key.split("/"):
            video_path = (Path(settings.BACKEND_STORAGE_ROOT) / cleaned_key).resolve()
            metrics = MediaPipeVisionBackend().analyze_video(str(video_path))
            # 2026-04-29 신규: 영상 파일 접근 실패 등 backend가 건너뛴 경우 면접 흐름은 계속 진행
            if metrics.status == VisionResultStatus.SKIPPED:
                return {
                    "status": VisionResultStatus.SKIPPED,
                    "score": 0,
                    "summary": "영상 분석을 완료하지 못해 내용 평가만 반영했습니다.",
                    "metrics": {
                        "faceDetectedRatio": metrics.face_detected_ratio,
                        "multiFaceDetected": metrics.multi_face_detected,
                        "lowLight": metrics.low_light,
                        "obstructionDetected": metrics.obstruction_detected,
                        "gazeStable": metrics.gaze_stable,
                    },
                }
            face_ratio = metrics.face_detected_ratio
            multi_face = metrics.multi_face_detected
            low_light = metrics.low_light
            obstruction = metrics.obstruction_detected
            gaze_stable = metrics.gaze_stable
        else:
            face_ratio = 0.0
            multi_face = False
            low_light = False
            obstruction = False
            gaze_stable = False
    else:
        # 2026-04-29 수정: 실제 영상이 없을 때만 요청 메타데이터 기반 fallback을 유지
        face_ratio = payload.faceDetectedRatio if payload.faceDetectedRatio is not None else 0.8
        multi_face = bool(payload.multiFaceDetected)
        low_light = bool(payload.lowLight)
        obstruction = bool(payload.obstructionDetected)
        gaze_stable = True if payload.gazeStable is None else bool(payload.gazeStable)

    if multi_face:
        return {
            "status": VisionResultStatus.INVALID,
            "score": 0,
            "summary": "다중 얼굴이 감지되어 이번 턴의 비언어 평가는 무효 처리했습니다.",
            "metrics": {
                "faceDetectedRatio": face_ratio,
                "multiFaceDetected": multi_face,
                "lowLight": low_light,
                "obstructionDetected": obstruction,
                "gazeStable": gaze_stable,
            },
        }

    if face_ratio < 0.55:
        return {
            "status": VisionResultStatus.INVALID,
            "score": 0,
            "summary": "얼굴 유지율이 낮아 이번 턴의 비언어 평가는 반영하지 않았습니다.",
            "metrics": {
                "faceDetectedRatio": face_ratio,
                "multiFaceDetected": multi_face,
                "lowLight": low_light,
                "obstructionDetected": obstruction,
                "gazeStable": gaze_stable,
            },
        }

    if low_light or obstruction:
        return {
            "status": VisionResultStatus.WEAKENED,
            "score": 4 if gaze_stable else 3,
            "summary": "저조도 또는 가림 요소가 있어 비언어 점수 반영을 약하게 적용했습니다.",
            "metrics": {
                "faceDetectedRatio": face_ratio,
                "multiFaceDetected": multi_face,
                "lowLight": low_light,
                "obstructionDetected": obstruction,
                "gazeStable": gaze_stable,
            },
        }

    return {
        "status": VisionResultStatus.VALID,
        "score": 8 if gaze_stable else 6,
        "summary": "얼굴 유지율과 촬영 상태가 안정적이라 기본 비언어 점수를 반영했습니다.",
        "metrics": {
            "faceDetectedRatio": face_ratio,
            "multiFaceDetected": multi_face,
            "lowLight": low_light,
            "obstructionDetected": obstruction,
            "gazeStable": gaze_stable,
        },
    }

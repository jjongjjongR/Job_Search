from abc import ABC, abstractmethod
from dataclasses import dataclass

from app.schemas.common import VisionResultStatus


@dataclass(frozen=True)
class VisionMetrics:
    # 2026-04-29 신규: 분석 프레임 중 얼굴이 감지된 비율을 표준 출력으로 정의
    face_detected_ratio: float
    # 2026-04-29 신규: 다중 얼굴 검출 여부를 표준 출력으로 정의
    multi_face_detected: bool
    # 2026-04-29 신규: 저조도 여부를 표준 출력으로 정의
    low_light: bool
    # 2026-04-29 신규: 얼굴 가림 의심 여부를 표준 출력으로 정의
    obstruction_detected: bool
    # 2026-04-29 신규: 정면 응시 프록시 안정 여부를 표준 출력으로 정의
    gaze_stable: bool
    # 2026-04-29 신규: Vision 결과 사용 가능 상태를 표준 출력으로 정의
    status: VisionResultStatus


class VisionInferenceBackend(ABC):
    @abstractmethod
    def analyze_video(self, video_path: str) -> VisionMetrics:
        pass

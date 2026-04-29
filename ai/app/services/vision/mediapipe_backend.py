from collections.abc import Iterator
from pathlib import Path

import cv2
import mediapipe as mp

from app.schemas.common import VisionResultStatus
from app.services.vision.base import VisionInferenceBackend, VisionMetrics

MAX_SAMPLED_FRAMES = 60
FACE_RATIO_INVALID_THRESHOLD = 0.3
FACE_RATIO_WEAK_THRESHOLD = 0.6
LOW_LIGHT_THRESHOLD = 60.0


class MediaPipeVisionBackend(VisionInferenceBackend):
    def analyze_video(self, video_path: str) -> VisionMetrics:
        # 2026-04-29 신규: 비정상 영상 경로는 Vision을 건너뛴 상태로 반환
        if not Path(video_path).is_file():
            return self._skipped_metrics()

        capture = cv2.VideoCapture(video_path)
        # 2026-04-29 신규: OpenCV가 영상을 열지 못하면 Vision을 건너뛴 상태로 반환
        if not capture.isOpened():
            return self._skipped_metrics()

        try:
            sampled_frames = list(self._sample_frames(capture))
        finally:
            capture.release()

        # 2026-04-29 신규: 분석할 프레임이 없으면 Vision을 건너뛴 상태로 반환
        if not sampled_frames:
            return self._skipped_metrics()

        face_detected_count = 0
        multi_face_detected = False
        low_light_count = 0

        with mp.solutions.face_detection.FaceDetection(
            model_selection=0,
            min_detection_confidence=0.5,
        ) as detector:
            for frame in sampled_frames:
                if self._is_low_light(frame):
                    low_light_count += 1

                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                result = detector.process(rgb_frame)
                detections = result.detections or []

                if detections:
                    face_detected_count += 1
                if len(detections) > 1:
                    multi_face_detected = True

        frame_count = len(sampled_frames)
        face_detected_ratio = face_detected_count / frame_count
        low_light = low_light_count / frame_count >= 0.5
        obstruction_detected = face_detected_ratio < FACE_RATIO_WEAK_THRESHOLD
        gaze_stable = face_detected_ratio >= FACE_RATIO_WEAK_THRESHOLD
        status = self._build_status(
            face_detected_ratio=face_detected_ratio,
            multi_face_detected=multi_face_detected,
            low_light=low_light,
            obstruction_detected=obstruction_detected,
        )

        return VisionMetrics(
            face_detected_ratio=round(face_detected_ratio, 3),
            multi_face_detected=multi_face_detected,
            low_light=low_light,
            obstruction_detected=obstruction_detected,
            gaze_stable=gaze_stable,
            status=status,
        )

    def _sample_frames(self, capture: cv2.VideoCapture) -> Iterator[object]:
        frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        if frame_count <= 0:
            return

        step = max(frame_count // MAX_SAMPLED_FRAMES, 1)
        for frame_index in range(0, frame_count, step):
            capture.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
            success, frame = capture.read()
            if success:
                yield frame

    def _is_low_light(self, frame: object) -> bool:
        gray_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        return float(gray_frame.mean()) < LOW_LIGHT_THRESHOLD

    def _build_status(
        self,
        face_detected_ratio: float,
        multi_face_detected: bool,
        low_light: bool,
        obstruction_detected: bool,
    ) -> VisionResultStatus:
        if multi_face_detected or face_detected_ratio < FACE_RATIO_INVALID_THRESHOLD:
            return VisionResultStatus.INVALID
        if low_light or obstruction_detected:
            return VisionResultStatus.WEAKENED
        return VisionResultStatus.VALID

    def _skipped_metrics(self) -> VisionMetrics:
        return VisionMetrics(
            face_detected_ratio=0.0,
            multi_face_detected=False,
            low_light=False,
            obstruction_detected=False,
            gaze_stable=False,
            status=VisionResultStatus.SKIPPED,
        )

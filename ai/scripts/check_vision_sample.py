# 2026-05-17 신규: 로컬 영상 파일로 Vision 정상/약화/무효 판정을 재현 검증하는 스크립트
from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from dataclasses import asdict
from pathlib import Path

# 2026-05-17 신규: 파일 경로로 직접 실행해도 ai/app 패키지를 찾도록 프로젝트 루트를 import 경로에 추가
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# 2026-05-17 신규: MediaPipe import 중 Matplotlib 캐시가 홈 디렉터리에 쓰이지 않도록 임시 경로 사용
os.environ.setdefault("MPLCONFIGDIR", str(Path(tempfile.gettempdir()) / "world-job-search-mpl"))

from app.services.vision.mediapipe_backend import MediaPipeVisionBackend


def main() -> None:
    parser = argparse.ArgumentParser(description="Check MediaPipe vision metrics for a video file.")
    parser.add_argument("video_path", help="Path to an interview sample video.")
    args = parser.parse_args()

    video_path = Path(args.video_path).expanduser().resolve()
    if not video_path.is_file():
        raise SystemExit(f"Video file not found: {video_path}")

    metrics = MediaPipeVisionBackend().analyze_video(str(video_path))
    payload = asdict(metrics)
    payload["status"] = metrics.status.value

    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

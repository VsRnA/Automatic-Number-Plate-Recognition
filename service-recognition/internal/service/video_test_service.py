import logging
import os

import cv2

from internal.model.models import VideoFrameResult
from internal.service.recognition_service import RecognitionService

logger = logging.getLogger(__name__)


class VideoTestService:
    def __init__(self, recognition_service: RecognitionService, frame_interval: int = 10):
        self._service = recognition_service
        self._frame_interval = frame_interval

    def process_video(self, video_path: str) -> list[VideoFrameResult]:
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found: {video_path}")

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise RuntimeError(f"Cannot open video: {video_path}")

        results = []
        frame_number = 0

        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                frame_number += 1

                if frame_number % self._frame_interval != 0:
                    continue

                result = self._service.process_frame(frame)

                if not result.plates:
                    continue

                screenshot_url = self._service.save_screenshot(frame, result.plates)

                results.append(VideoFrameResult(
                    frame_number=frame_number,
                    plates=result.plates,
                    screenshot_url=screenshot_url,
                ))
        finally:
            cap.release()

        logger.info(f"Video done: {len(results)} frames with plates out of {frame_number} total")
        return results

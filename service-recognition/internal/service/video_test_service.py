import logging
import os

import cv2

from internal.model.models import BoundingBox, PlateResult, VideoFrameResult
from internal.service.recognition_service import RecognitionService
from internal.tracking.tracker import ConfirmedDetection, Tracker

logger = logging.getLogger(__name__)


class VideoTestService:
    def __init__(
        self,
        recognition_service: RecognitionService,
    ):
        self._service = recognition_service

    def process_video(self, video_path: str, frame_interval: int = 10) -> list[VideoFrameResult]:
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found: {video_path}")

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise RuntimeError(f"Cannot open video: {video_path}")

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        duration_sec = total_frames / fps if total_frames > 0 else 0.0

        if duration_sec < 10:
            frame_interval = max(1, frame_interval // 3)
            logger.debug(f"Short video ({duration_sec:.1f}s): frame_interval reduced to {frame_interval}")

        tracker = Tracker(stale_frames=10, fuzzy_distance=1, min_iou=0.3, min_readings=2, text_match_enabled=False)

        confirmed_plates: set[str] = set()
        results: list[VideoFrameResult] = []
        frame_number = 0

        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                frame_number += 1

                if frame_number % frame_interval != 0:
                    continue

                detections = self._service.process_frame(frame)
                confirmed_list = tracker.update(detections)

                for confirmed in confirmed_list:
                    result = self._handle_confirmed(confirmed, frame_number, confirmed_plates)
                    if result is not None:
                        results.append(result)

            for confirmed in tracker.flush():
                result = self._handle_confirmed(confirmed, frame_number, confirmed_plates)
                if result is not None:
                    results.append(result)

        finally:
            cap.release()

        logger.info(f"Video done: {len(results)} unique plates from {frame_number} frames")
        return results

    def _handle_confirmed(
        self,
        confirmed: ConfirmedDetection,
        frame_number: int,
        confirmed_plates: set[str],
    ) -> VideoFrameResult | None:
        if confirmed.plate_text in confirmed_plates:
            return None
        confirmed_plates.add(confirmed.plate_text)

        screenshot_url: str | None = None
        if confirmed.best_frame is not None:
            plate_result = PlateResult(
                plate_number=confirmed.plate_text,
                confidence=confirmed.confidence,
                bounding_box=confirmed.plate_bbox,
            )
            try:
                screenshot_url = self._service.save_screenshot(
                    confirmed.best_frame, plate_result, confirmed.plate_bbox
                )
            except Exception as e:
                logger.warning(f"Screenshot save failed for plate {confirmed.plate_text!r}: {e}")

            if confirmed.vehicle_bbox is not None:
                try:
                    self._service.save_car_crop(
                        confirmed.best_frame, confirmed.vehicle_bbox, confirmed.plate_text
                    )
                except Exception as e:
                    logger.warning(f"Car crop save failed for plate {confirmed.plate_text!r}: {e}")

            try:
                self._service.save_plate_crop(
                    confirmed.best_frame, confirmed.plate_bbox, confirmed.plate_text
                )
            except Exception as e:
                logger.warning(f"Plate crop save failed for plate {confirmed.plate_text!r}: {e}")

        logger.info(f"Video: confirmed plate {confirmed.plate_text!r} at frame {frame_number}")

        return VideoFrameResult(
            frame_number=frame_number,
            plates=[PlateResult(
                plate_number=confirmed.plate_text,
                confidence=confirmed.confidence,
                bounding_box=confirmed.plate_bbox,
            )],
            screenshot_url=screenshot_url,
        )

import logging
import os
from typing import Optional

import cv2
import numpy as np

from internal.model.models import BoundingBox, PlateResult, VideoFrameResult
from internal.service.recognition_service import RecognitionService
from internal.service.worker_thread import PlateVotingBuffer

logger = logging.getLogger(__name__)


class VideoTestService:
    def __init__(
        self,
        recognition_service: RecognitionService,
        frame_interval: int = 10,
        confidence_threshold: float = 0.5,
    ):
        self._service = recognition_service
        self._frame_interval = frame_interval
        self._confidence_threshold = confidence_threshold

    def process_video(self, video_path: str) -> list[VideoFrameResult]:
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found: {video_path}")

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise RuntimeError(f"Cannot open video: {video_path}")

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        duration_sec = total_frames / fps if total_frames > 0 else 0.0

        # For short videos reduce frame_interval so voting buffer accumulates enough reads
        if duration_sec < 10:
            frame_interval = max(1, self._frame_interval // 3)
            logger.debug(f"Short video ({duration_sec:.1f}s): frame_interval reduced to {frame_interval}")
        else:
            frame_interval = self._frame_interval

        voting_buffer = PlateVotingBuffer(min_votes=3, buffer_size=10, stale_frames=10)

        last_detection_frame: Optional[np.ndarray] = None
        last_best_plate: Optional[PlateResult] = None

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

                result = self._service.process_frame(frame)

                best_plate: Optional[PlateResult] = None
                for plate in result.plates:
                    if plate.confidence >= self._confidence_threshold:
                        if best_plate is None or plate.confidence > best_plate.confidence:
                            best_plate = plate

                if best_plate is not None:
                    last_detection_frame = frame.copy()
                    last_best_plate = best_plate

                voted = voting_buffer.on_frame(best_plate.plate_number if best_plate else None)

                if voted is None:
                    continue

                voted_plate, vote_confidence = voted

                if voted_plate in confirmed_plates:
                    continue
                confirmed_plates.add(voted_plate)

                screenshot_url: Optional[str] = None
                if last_detection_frame is not None and last_best_plate is not None:
                    try:
                        screenshot_url = self._service.save_screenshot(
                            last_detection_frame, [last_best_plate]
                        )
                    except Exception as e:
                        logger.warning(f"Screenshot save failed for plate {voted_plate!r}: {e}")

                confirmed_result = PlateResult(
                    plate_number=voted_plate,
                    confidence=vote_confidence,
                    bounding_box=last_best_plate.bounding_box if last_best_plate else BoundingBox(0, 0, 0, 0),
                )

                results.append(VideoFrameResult(
                    frame_number=frame_number,
                    plates=[confirmed_result],
                    screenshot_url=screenshot_url,
                ))

                logger.info(f"Video: confirmed plate {voted_plate!r} at frame {frame_number}")

            # Flush remaining buffer — catches plates in videos too short to reach min_votes
            flushed = voting_buffer.flush()
            if flushed is not None:
                voted_plate, vote_confidence = flushed
                if voted_plate not in confirmed_plates:
                    confirmed_plates.add(voted_plate)
                    screenshot_url = None
                    if last_detection_frame is not None and last_best_plate is not None:
                        try:
                            screenshot_url = self._service.save_screenshot(
                                last_detection_frame, [last_best_plate]
                            )
                        except Exception as e:
                            logger.warning(f"Screenshot save failed for plate {voted_plate!r}: {e}")

                    results.append(VideoFrameResult(
                        frame_number=frame_number,
                        plates=[PlateResult(
                            plate_number=voted_plate,
                            confidence=vote_confidence,
                            bounding_box=last_best_plate.bounding_box if last_best_plate else BoundingBox(0, 0, 0, 0),
                        )],
                        screenshot_url=screenshot_url,
                    ))
                    logger.info(f"Video flush: confirmed plate {voted_plate!r} at end of video")

        finally:
            cap.release()

        logger.info(f"Video done: {len(results)} unique plates from {frame_number} frames")
        return results

import logging
import re
import time
from datetime import datetime

import cv2
import numpy as np

from internal.exception.exceptions import RecognitionError
from internal.model.models import BoundingBox, PlateResult, RecognitionResult
from internal.ml.frame_annotator import annotate_plates
from internal.ml.plate_detector import PlateDetection, PlateDetector
from internal.ml.text_recognizer import TextRecognizer
from infrastructure.storage.s3_client import S3Client

_PLATE_PATTERN = re.compile(r'^[ABEKMHOPCTYX]\d{3}[ABEKMHOPCTYX]{2}\d{2}$')

logger = logging.getLogger(__name__)


def _is_valid_plate(text: str) -> bool:
    return len(text) == 8 and bool(_PLATE_PATTERN.match(text))


def _expand_bbox_to_ratio(
    x1: int, y1: int, x2: int, y2: int,
    target_ratio: float,
    frame_shape: tuple,
) -> tuple[int, int, int, int]:
    h, w = frame_shape[:2]
    box_w = max(1, x2 - x1)
    box_h = max(1, y2 - y1)
    cx = x1 + box_w // 2
    cy = y1 + box_h // 2
    if box_w / box_h < target_ratio:
        new_w = int(box_h * target_ratio)
        new_h = box_h
    else:
        new_w = box_w
        new_h = int(box_w / target_ratio)
    x1 = int(max(0, cx - new_w // 2))
    x2 = int(min(w, cx + new_w // 2))
    y1 = int(max(0, cy - new_h // 2))
    y2 = int(min(h, cy + new_h // 2))
    return x1, y1, x2, y2


class RecognitionService:
    def __init__(
        self,
        plate_detector: PlateDetector,
        text_recognizer: TextRecognizer,
        s3_client: S3Client,
        confidence_threshold: float = 0.5,
    ):
        self._detector = plate_detector
        self._recognizer = text_recognizer
        self._s3 = s3_client
        self._confidence_threshold = confidence_threshold

    def process_frame(self, frame: np.ndarray) -> RecognitionResult:
        start = time.time()

        detections = self._detector.detect(frame)

        plates = []
        for detection in detections:
            if detection.confidence < self._confidence_threshold:
                continue

            x1 = detection.x1
            y1 = detection.y1
            x2 = detection.x2
            y2 = detection.y2

            if (x2 - x1) < 30 or (y2 - y1) < 10:
                continue

            x1, y1, x2, y2 = _expand_bbox_to_ratio(
                x1, y1, x2, y2,
                target_ratio=4.5,
                frame_shape=frame.shape,
            )

            crop = frame[y1:y2, x1:x2]
            if crop.size == 0:
                continue

            result = self._recognizer.recognize(crop)
            if result is None:
                continue

            text, ocr_confidence = result
            if not _is_valid_plate(text):
                continue

            plates.append(PlateResult(
                plate_number=text,
                confidence=detection.confidence * ocr_confidence,
                bounding_box=BoundingBox(
                    x=x1,
                    y=y1,
                    width=x2 - x1,
                    height=y2 - y1,
                ),
            ))

        processing_ms = int((time.time() - start) * 1000)
        return RecognitionResult(
            plates=plates,
            processing_time_ms=str(processing_ms),
        )

    def save_screenshot(self, frame: np.ndarray, plates: list[PlateResult]) -> str | None:
        annotated = annotate_plates(frame, plates)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
        plate_label = plates[0].plate_number if plates else "unknown"
        file_name = f"{timestamp}-{plate_label}.jpg"

        ok, buffer = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 90])
        if not ok:
            raise RecognitionError("JPEG encode failed")

        return self._s3.upload_file(
            file_data=buffer.tobytes(),
            file_name=file_name,
            content_type="image/jpeg",
        )

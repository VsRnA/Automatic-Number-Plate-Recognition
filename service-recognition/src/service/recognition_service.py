import logging
import re
import time

import numpy as np

from src.config import settings
from src.domain.models import BoundingBox, PlateResult, RecognitionResult
from src.infrastructure.model_loader import ModelLoader

logger = logging.getLogger(__name__)


class RecognitionService:
    """Business logic for plate recognition."""

    def __init__(self):
        """Initialize recognition service with lazy-loaded models."""
        self._model_loader = ModelLoader()

    def recognize_from_image(
        self, image_base64: str, use_sample_image: bool
    ) -> RecognitionResult:
        """
        Recognize plates from image.

        For now returns mock data. Will be implemented with YOLO + EasyOCR.
        """
        if use_sample_image or not image_base64:
            # Return sample data for testing
            sample_plate = PlateResult(
                plate_number="A123BC77",
                confidence=0.95,
                bounding_box=BoundingBox(x=100, y=200, width=150, height=50),
            )
            return RecognitionResult(
                success=True,
                plates=[sample_plate],
                processing_time_ms="42",
            )

        # TODO: Implement actual recognition with YOLO + EasyOCR
        return RecognitionResult(
            success=False,
            plates=[],
            processing_time_ms="0",
            error="Image recognition not implemented yet",
        )

    def recognize_from_frame(self, frame: np.ndarray) -> RecognitionResult:
        """
        Recognize plates from OpenCV frame.

        Args:
            frame: OpenCV frame (BGR format)

        Returns:
            RecognitionResult with detected plates
        """
        start_time = time.time()

        try:
            # Step 1: Detect plates with YOLO
            detections = self._detect_plates(frame)

            if not detections:
                processing_time = int((time.time() - start_time) * 1000)
                return RecognitionResult(
                    success=True,
                    plates=[],
                    processing_time_ms=str(processing_time),
                )

            # Step 2: Recognize text with OCR
            plates = []
            for detection in detections:
                plate_result = self._recognize_plate_text(frame, detection)
                if plate_result:
                    plates.append(plate_result)

            processing_time = int((time.time() - start_time) * 1000)

            return RecognitionResult(
                success=True,
                plates=plates,
                processing_time_ms=str(processing_time),
            )

        except Exception as e:
            processing_time = int((time.time() - start_time) * 1000)
            logger.error(f"Error during plate recognition: {e}", exc_info=True)
            return RecognitionResult(
                success=False,
                plates=[],
                processing_time_ms=str(processing_time),
                error=str(e),
            )

    def _detect_plates(self, frame: np.ndarray) -> list[dict]:
        """
        Detect license plates in frame using YOLO.

        Args:
            frame: OpenCV frame

        Returns:
            List of detections with format:
            [{"x": int, "y": int, "width": int, "height": int, "confidence": float}]
        """
        try:
            model = self._model_loader.get_yolo_model(settings.yolo_model_path)

            # Run inference
            results = model(frame, verbose=False)

            detections = []
            for result in results:
                boxes = result.boxes
                for box in boxes:
                    # Get coordinates
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    confidence = float(box.conf[0])

                    # Convert to x, y, width, height format
                    detection = {
                        "x": int(x1),
                        "y": int(y1),
                        "width": int(x2 - x1),
                        "height": int(y2 - y1),
                        "confidence": confidence,
                    }
                    detections.append(detection)

            logger.debug(f"YOLO detected {len(detections)} plates")
            return detections

        except Exception as e:
            logger.error(f"YOLO detection failed: {e}", exc_info=True)
            return []

    def _recognize_plate_text(
        self, frame: np.ndarray, detection: dict
    ) -> PlateResult | None:
        """
        Recognize text from detected plate region using EasyOCR.

        Args:
            frame: Original OpenCV frame
            detection: Detection dict with x, y, width, height, confidence

        Returns:
            PlateResult or None if recognition failed
        """
        try:
            # Crop plate region
            x = detection["x"]
            y = detection["y"]
            w = detection["width"]
            h = detection["height"]
            yolo_confidence = detection["confidence"]

            # Ensure coordinates are within frame bounds
            frame_height, frame_width = frame.shape[:2]
            x = max(0, x)
            y = max(0, y)
            w = min(w, frame_width - x)
            h = min(h, frame_height - y)

            plate_crop = frame[y : y + h, x : x + w]

            if plate_crop.size == 0:
                logger.warning("Empty plate crop, skipping OCR")
                return None

            # Get OCR reader
            reader = self._model_loader.get_ocr_reader(
                languages=settings.ocr_languages, gpu=settings.ocr_gpu
            )

            # Run OCR
            results = reader.readtext(plate_crop)

            if not results:
                logger.debug("No text detected by OCR")
                return None

            # Get the text with highest confidence
            best_result = max(results, key=lambda r: r[2])
            text = best_result[1]
            ocr_confidence = best_result[2]

            # Normalize text
            normalized_text = self._normalize_plate_text(text)

            if not normalized_text:
                logger.debug(f"Text normalization failed for: {text}")
                return None

            # Combined confidence (YOLO * OCR)
            combined_confidence = yolo_confidence * ocr_confidence

            return PlateResult(
                plate_number=normalized_text,
                confidence=combined_confidence,
                bounding_box=BoundingBox(x=x, y=y, width=w, height=h),
            )

        except Exception as e:
            logger.error(f"OCR recognition failed: {e}", exc_info=True)
            return None

    def _normalize_plate_text(self, text: str) -> str:
        """
        Normalize plate text to standard format.

        Args:
            text: Raw OCR text

        Returns:
            Normalized text (uppercase, alphanumeric only)
        """
        # Remove spaces and convert to uppercase
        normalized = text.upper().replace(" ", "")

        # Keep only alphanumeric characters
        normalized = re.sub(r"[^A-Z0-9]", "", normalized)

        # Basic validation: should have at least 5 characters
        if len(normalized) < 5:
            return ""

        return normalized

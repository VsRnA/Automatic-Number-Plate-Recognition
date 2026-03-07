import logging
import re
from datetime import datetime

import cv2
import numpy as np

from internal.exception.exceptions import RecognitionError
from internal.model.models import BoundingBox, PlateResult
from internal.model.detections import FrameDetection, PlateDetection, VehicleDetection
from internal.ml.frame_annotator import annotate_plates
from internal.ml.plate_detector import PlateDetector
from internal.ml.vehicle_detector import VehicleDetector
from internal.ml.text_recognizer import TextRecognizer
from internal.ml.preprocessing.roi import extract_roi
from internal.ml.preprocessing.bbox_utils import associate_plates_to_vehicles
from internal.ml.preprocessing.crop_extractor import extract_plate_crop
from internal.ml.preprocessing.image_enhancer import deskew_plate, enhance_plate
from infrastructure.storage.s3_client import S3Client

_PLATE_PATTERN = re.compile(r'^[ABEKMHOPCTYX]\d{3}[ABEKMHOPCTYX]{2}\d{2}$')

logger = logging.getLogger(__name__)


def is_valid_plate(text: str) -> bool:
    return len(text) == 8 and bool(_PLATE_PATTERN.match(text))


class RecognitionService:
    def __init__(
        self,
        vehicle_detector: VehicleDetector,
        plate_detector: PlateDetector,
        text_recognizer: TextRecognizer,
        s3_client: S3Client,
        confidence_threshold: float = 0.5,
        roi_enabled: bool = True,
        roi_x_percent: float = 0.1,
        roi_y_percent: float = 0.2,
        roi_w_percent: float = 0.8,
        roi_h_percent: float = 0.6,
        plate_min_width: int = 128,
        plate_min_height: int = 32,
    ):
        self._vehicle_detector = vehicle_detector
        self._plate_detector = plate_detector
        self._recognizer = text_recognizer
        self._s3 = s3_client
        self._confidence_threshold = confidence_threshold
        self._roi_enabled = roi_enabled
        self._roi_x_percent = roi_x_percent
        self._roi_y_percent = roi_y_percent
        self._roi_w_percent = roi_w_percent
        self._roi_h_percent = roi_h_percent
        self._plate_min_width = plate_min_width
        self._plate_min_height = plate_min_height

    def process_frame(self, frame: np.ndarray) -> list[FrameDetection]:
        """Run full pipeline on a single frame. Returns list of valid FrameDetection."""
        roi, (offset_x, offset_y) = extract_roi(
            frame,
            enabled=self._roi_enabled,
            x_pct=self._roi_x_percent,
            y_pct=self._roi_y_percent,
            w_pct=self._roi_w_percent,
            h_pct=self._roi_h_percent,
        )

        raw_vehicles = self._vehicle_detector.detect(roi)
        raw_plates = self._plate_detector.detect(roi)

        # Filter plates by confidence threshold
        filtered_plates = [p for p in raw_plates if p.confidence >= self._confidence_threshold]
        logger.debug(
            f"process_frame: {len(raw_vehicles)} vehicles, "
            f"{len(raw_plates)} plate detections ({len(filtered_plates)} above threshold)"
        )

        if not filtered_plates:
            return []

        # Remap detections from ROI coords to full-frame coords
        vehicle_detections = [
            VehicleDetection(
                bbox=BoundingBox(
                    x=v.bbox.x + offset_x,
                    y=v.bbox.y + offset_y,
                    width=v.bbox.width,
                    height=v.bbox.height,
                ),
                confidence=v.confidence,
                class_id=v.class_id,
            )
            for v in raw_vehicles
        ]

        plate_detections = [
            PlateDetection(
                bbox=BoundingBox(
                    x=p.x1 + offset_x,
                    y=p.y1 + offset_y,
                    width=p.x2 - p.x1,
                    height=p.y2 - p.y1,
                ),
                confidence=p.confidence,
            )
            for p in filtered_plates
            if (p.x2 - p.x1) >= 10 and (p.y2 - p.y1) >= 5
        ]

        associations = associate_plates_to_vehicles(vehicle_detections, plate_detections)

        results: list[FrameDetection] = []
        for vehicle, plate_det in associations:
            crop = extract_plate_crop(
                frame,
                plate_det.bbox,
                min_w=self._plate_min_width,
                min_h=self._plate_min_height,
            )
            if crop.size == 0:
                continue

            crop = deskew_plate(crop)
            crop = enhance_plate(crop)

            ocr_result = self._recognizer.recognize(crop)
            if ocr_result is None:
                continue

            text, ocr_confidence = ocr_result
            if not is_valid_plate(text):
                logger.debug(f"process_frame: OCR rejected text {text!r} (invalid plate format)")
                self._save_rejected(frame, vehicle, plate_det, crop, text)
                continue

            results.append(FrameDetection(
                plate=plate_det,
                vehicle=vehicle,
                plate_text=text,
                ocr_confidence=ocr_confidence,
                frame=frame,
            ))

        return results

    def _save_rejected(
        self,
        frame: np.ndarray,
        vehicle: VehicleDetection | None,
        plate_det: PlateDetection,
        number_crop: np.ndarray,
        ocr_text: str,
    ) -> None:
        """Save rejected detection to *_reject/ folders."""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]

            # number_reject — processed OCR crop with border and label
            h, w = number_crop.shape[:2]
            bordered = number_crop.copy()
            cv2.rectangle(bordered, (0, 0), (w - 1, h - 1), (0, 0, 255), 2)
            target_w = 320
            scale = target_w / max(1, w)
            target_h = max(1, int(h * scale))
            resized = cv2.resize(bordered, (target_w, target_h), interpolation=cv2.INTER_LINEAR)
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 0.6
            thickness = 1
            label = ocr_text or ""
            (tw, th), baseline = cv2.getTextSize(label, font, font_scale, thickness)
            label_h = th + baseline + 8
            label_strip = np.zeros((label_h, target_w, 3), dtype=np.uint8)
            tx = max(4, (target_w - tw) // 2)
            ty = th + 4
            cv2.putText(label_strip, label, (tx, ty), font, font_scale, (0, 0, 0), thickness + 2, cv2.LINE_AA)
            cv2.putText(label_strip, label, (tx, ty), font, font_scale, (0, 0, 255), thickness, cv2.LINE_AA)
            labeled = np.vstack([label_strip, resized])
            ok, buffer = cv2.imencode(".jpg", labeled, [cv2.IMWRITE_JPEG_QUALITY, 90])
            if ok:
                self._s3.upload_file(
                    file_data=buffer.tobytes(),
                    file_name=f"number_reject/{timestamp}.jpg",
                    content_type="image/jpeg",
                )

            # plate_reject
            fh, fw = frame.shape[:2]
            pad = 10
            px1 = max(0, plate_det.bbox.x - pad)
            py1 = max(0, plate_det.bbox.y - pad)
            px2 = min(fw, plate_det.bbox.x + plate_det.bbox.width + pad)
            py2 = min(fh, plate_det.bbox.y + plate_det.bbox.height + pad)
            plate_crop = frame[py1:py2, px1:px2].copy()
            if plate_crop.size > 0:
                rel_x1 = plate_det.bbox.x - px1
                rel_y1 = plate_det.bbox.y - py1
                rel_x2 = plate_det.bbox.x + plate_det.bbox.width - px1
                rel_y2 = plate_det.bbox.y + plate_det.bbox.height - py1
                cv2.rectangle(plate_crop, (rel_x1, rel_y1), (rel_x2, rel_y2), (0, 0, 255), 2)
                ok, buffer = cv2.imencode(".jpg", plate_crop, [cv2.IMWRITE_JPEG_QUALITY, 90])
                if ok:
                    self._s3.upload_file(
                        file_data=buffer.tobytes(),
                        file_name=f"plate_reject/{timestamp}.jpg",
                        content_type="image/jpeg",
                    )

            # car_reject
            if vehicle is not None:
                vb = vehicle.bbox
                cx = vb.x + vb.width // 2
                cy = vb.y + vb.height // 2
                half_w = vb.width * 5 // 2
                half_h = vb.height * 5 // 2
                cx1 = max(0, cx - half_w)
                cx2 = min(fw, cx + half_w)
                cy1 = max(0, cy - half_h)
                cy2 = min(fh, cy + half_h)
                car_crop = frame[cy1:cy2, cx1:cx2].copy()
                if car_crop.size > 0:
                    cv2.rectangle(
                        car_crop,
                        (vb.x - cx1, vb.y - cy1),
                        (vb.x + vb.width - cx1, vb.y + vb.height - cy1),
                        (0, 0, 255), 2,
                    )
                    ok, buffer = cv2.imencode(".jpg", car_crop, [cv2.IMWRITE_JPEG_QUALITY, 85])
                    if ok:
                        self._s3.upload_file(
                            file_data=buffer.tobytes(),
                            file_name=f"car_reject/{timestamp}.jpg",
                            content_type="image/jpeg",
                        )
        except Exception:
            logger.exception("Failed to save rejected detection to S3")

    def save_screenshot(
        self,
        frame: np.ndarray,
        plate_result: PlateResult,
        plate_bbox: BoundingBox,
    ) -> str | None:
        annotated = annotate_plates(frame, [plate_result])

        h, w = frame.shape[:2]
        pad_x = plate_bbox.width
        pad_y = plate_bbox.height
        x1 = max(0, plate_bbox.x - pad_x)
        y1 = max(0, plate_bbox.y - pad_y)
        x2 = min(w, plate_bbox.x + plate_bbox.width + pad_x)
        y2 = min(h, plate_bbox.y + plate_bbox.height + pad_y)

        crop = annotated[y1:y2, x1:x2]
        if crop.size == 0:
            crop = annotated

        ok, buffer = cv2.imencode(".jpg", crop, [cv2.IMWRITE_JPEG_QUALITY, 90])
        if not ok:
            raise RecognitionError("JPEG encode failed")

        return self._s3.upload_file(
            file_data=buffer.tobytes(),
            file_name=f"{plate_result.plate_number}/number.jpg",
            content_type="image/jpeg",
        )

    def save_car_crop(self, frame: np.ndarray, bbox: BoundingBox, plate_number: str) -> str | None:
        h, w = frame.shape[:2]
        cx = bbox.x + bbox.width // 2
        cy = bbox.y + bbox.height // 2
        half_w = bbox.width * 5 // 2
        half_h = bbox.height * 5 // 2

        x1 = max(0, cx - half_w)
        x2 = min(w, cx + half_w)
        y1 = max(0, cy - half_h)
        y2 = min(h, cy + half_h)

        crop = frame[y1:y2, x1:x2].copy()
        if crop.size == 0:
            return None

        rel_x1 = bbox.x - x1
        rel_y1 = bbox.y - y1
        rel_x2 = bbox.x + bbox.width - x1
        rel_y2 = bbox.y + bbox.height - y1
        cv2.rectangle(crop, (rel_x1, rel_y1), (rel_x2, rel_y2), (0, 255, 0), 2)

        ok, buffer = cv2.imencode(".jpg", crop, [cv2.IMWRITE_JPEG_QUALITY, 85])
        if not ok:
            return None

        return self._s3.upload_file(
            file_data=buffer.tobytes(),
            file_name=f"{plate_number}/car.jpg",
            content_type="image/jpeg",
        )

    def save_plate_crop(self, frame: np.ndarray, bbox: BoundingBox, plate_number: str) -> str | None:
        h, w = frame.shape[:2]
        pad = 10
        x1 = max(0, bbox.x - pad)
        y1 = max(0, bbox.y - pad)
        x2 = min(w, bbox.x + bbox.width + pad)
        y2 = min(h, bbox.y + bbox.height + pad)

        crop = frame[y1:y2, x1:x2].copy()
        if crop.size == 0:
            return None

        rel_x1 = bbox.x - x1
        rel_y1 = bbox.y - y1
        rel_x2 = bbox.x + bbox.width - x1
        rel_y2 = bbox.y + bbox.height - y1
        cv2.rectangle(crop, (rel_x1, rel_y1), (rel_x2, rel_y2), (0, 255, 0), 2)

        ok, buffer = cv2.imencode(".jpg", crop, [cv2.IMWRITE_JPEG_QUALITY, 90])
        if not ok:
            return None

        return self._s3.upload_file(
            file_data=buffer.tobytes(),
            file_name=f"{plate_number}/plate.jpg",
            content_type="image/jpeg",
        )

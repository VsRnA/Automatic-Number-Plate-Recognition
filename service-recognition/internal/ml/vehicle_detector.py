import logging

import numpy as np

from internal.model.detections import VehicleDetection
from internal.model.models import BoundingBox

logger = logging.getLogger(__name__)


class VehicleDetector:
    def __init__(
        self,
        model: str,
        conf: float = 0.3,
        imgsz: int = 640,
        classes: list[int] | None = None,
    ):
        from ultralytics import YOLO
        self._model = YOLO(model)
        self._conf = conf
        self._imgsz = imgsz
        self._classes = classes or [2, 3, 5, 7]
        logger.info(
            f"VehicleDetector: loaded '{model}', conf={conf}, imgsz={imgsz}, classes={self._classes}"
        )

    def detect(self, frame: np.ndarray) -> list[VehicleDetection]:
        results = self._model(
            frame,
            imgsz=self._imgsz,
            conf=self._conf,
            classes=self._classes,
            verbose=False,
        )

        detections: list[VehicleDetection] = []
        for result in results:
            for box in result.boxes:
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                confidence = float(box.conf[0])
                class_id = int(box.cls[0])
                detections.append(VehicleDetection(
                    bbox=BoundingBox(
                        x=int(x1), y=int(y1),
                        width=int(x2 - x1), height=int(y2 - y1),
                    ),
                    confidence=confidence,
                    class_id=class_id,
                ))

        return detections

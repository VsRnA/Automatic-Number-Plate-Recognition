import logging
from dataclasses import dataclass

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class PlateDetection:
    x1: int
    y1: int
    x2: int
    y2: int
    confidence: float


class PlateDetector:
    def __init__(self, model_path: str, conf: float = 0.2):
        from ultralytics import YOLO
        self._model = YOLO(model_path)
        self._conf = conf
        logger.info(f"PlateDetector: loaded from '{model_path}'")

    def detect(self, frame: np.ndarray) -> list[PlateDetection]:
        results = self._model(frame, imgsz=640, conf=self._conf, verbose=False)

        detections = []
        for result in results:
            for box in result.boxes:
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                confidence = float(box.conf[0])
                detections.append(PlateDetection(
                    x1=int(x1), y1=int(y1),
                    x2=int(x2), y2=int(y2),
                    confidence=confidence,
                ))

        return detections

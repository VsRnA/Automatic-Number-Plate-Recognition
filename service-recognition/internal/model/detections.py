from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from internal.model.models import BoundingBox


@dataclass
class VehicleDetection:
    bbox: BoundingBox
    confidence: float
    class_id: int


@dataclass
class PlateDetection:
    bbox: BoundingBox
    confidence: float


@dataclass
class FrameDetection:
    """One plate + associated vehicle (if found) for a single frame."""
    plate: PlateDetection
    vehicle: VehicleDetection | None
    plate_text: str
    ocr_confidence: float
    frame: np.ndarray

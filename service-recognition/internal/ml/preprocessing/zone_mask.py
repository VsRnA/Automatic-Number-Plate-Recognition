import numpy as np
import cv2

from internal.model.zone import WorkerZoneConfig


def apply_zone_mask(frame: np.ndarray, zone: WorkerZoneConfig) -> np.ndarray:
    h, w = frame.shape[:2]

    pts = np.array(
        [[int(p.x * w), int(p.y * h)] for p in zone.points],
        dtype=np.int32,
    )

    mask = np.zeros((h, w), dtype=np.uint8)
    cv2.fillPoly(mask, [pts], 255)

    masked = frame.copy()
    masked[mask == 0] = 0
    return masked

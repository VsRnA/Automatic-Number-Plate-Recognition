from __future__ import annotations

from typing import TYPE_CHECKING

import numpy as np

from internal.model.models import BoundingBox

if TYPE_CHECKING:
    from internal.model.detections import PlateDetection, VehicleDetection


def iou(a: BoundingBox, b: BoundingBox) -> float:
    """Intersection over Union for two BoundingBox objects."""
    ax1, ay1 = a.x, a.y
    ax2, ay2 = a.x + a.width, a.y + a.height
    bx1, by1 = b.x, b.y
    bx2, by2 = b.x + b.width, b.y + b.height

    inter_x1 = max(ax1, bx1)
    inter_y1 = max(ay1, by1)
    inter_x2 = min(ax2, bx2)
    inter_y2 = min(ay2, by2)

    inter_w = max(0, inter_x2 - inter_x1)
    inter_h = max(0, inter_y2 - inter_y1)
    inter_area = inter_w * inter_h

    area_a = max(0, ax2 - ax1) * max(0, ay2 - ay1)
    area_b = max(0, bx2 - bx1) * max(0, by2 - by1)
    union_area = area_a + area_b - inter_area

    if union_area <= 0:
        return 0.0
    return inter_area / union_area


def expand_to_min_size(
    bbox: BoundingBox,
    frame_shape: tuple,
    min_w: int = 128,
    min_h: int = 32,
) -> BoundingBox:
    """Expand bbox to at least min_w x min_h, keeping center, clamped to frame."""
    h, w = frame_shape[:2]
    new_w = max(bbox.width, min_w)
    new_h = max(bbox.height, min_h)

    cx = bbox.x + bbox.width // 2
    cy = bbox.y + bbox.height // 2

    x1 = max(0, cx - new_w // 2)
    y1 = max(0, cy - new_h // 2)
    x2 = min(w, x1 + new_w)
    y2 = min(h, y1 + new_h)

    # Shift back if clamped
    if x2 - x1 < new_w:
        x1 = max(0, x2 - new_w)
    if y2 - y1 < new_h:
        y1 = max(0, y2 - new_h)

    return BoundingBox(x=x1, y=y1, width=x2 - x1, height=y2 - y1)


def associate_plates_to_vehicles(
    vehicles: list[VehicleDetection],
    plates: list[PlateDetection],
) -> list[tuple[VehicleDetection | None, PlateDetection]]:
    """
    Link each plate to the vehicle whose bbox contains the plate center.
    If no vehicle contains the plate center, pick the nearest vehicle by center distance.
    Plates without any vehicle get vehicle=None.
    """
    result: list[tuple[VehicleDetection | None, PlateDetection]] = []

    for plate in plates:
        plate_cx = plate.bbox.x + plate.bbox.width // 2
        plate_cy = plate.bbox.y + plate.bbox.height // 2

        matched_vehicle: VehicleDetection | None = None

        # First: check if plate center is inside a vehicle bbox
        for vehicle in vehicles:
            vx1 = vehicle.bbox.x
            vy1 = vehicle.bbox.y
            vx2 = vehicle.bbox.x + vehicle.bbox.width
            vy2 = vehicle.bbox.y + vehicle.bbox.height
            if vx1 <= plate_cx <= vx2 and vy1 <= plate_cy <= vy2:
                matched_vehicle = vehicle
                break

        # Fallback: nearest vehicle by center distance
        if matched_vehicle is None and vehicles:
            def center_dist(v: VehicleDetection) -> float:
                vcx = v.bbox.x + v.bbox.width // 2
                vcy = v.bbox.y + v.bbox.height // 2
                return float(np.hypot(plate_cx - vcx, plate_cy - vcy))

            matched_vehicle = min(vehicles, key=center_dist)

        result.append((matched_vehicle, plate))

    return result

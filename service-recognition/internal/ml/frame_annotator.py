import cv2
import numpy as np

from internal.model.models import PlateResult


def annotate_plates(frame: np.ndarray, plates: list[PlateResult]) -> np.ndarray:
    annotated = frame.copy()

    for plate in plates:
        bb = plate.bounding_box
        x1, y1 = bb.x, bb.y
        x2, y2 = bb.x + bb.width, bb.y + bb.height

        cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 0), 2)

        label = plate.plate_number
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.8
        thickness = 2
        (text_w, text_h), baseline = cv2.getTextSize(label, font, font_scale, thickness)

        text_y = max(y1 - 8, text_h + baseline + 2)
        cv2.rectangle(
            annotated,
            (x1, text_y - text_h - baseline),
            (x1 + text_w + 4, text_y + baseline),
            (0, 255, 0),
            -1,
        )
        cv2.putText(
            annotated, label,
            (x1 + 2, text_y),
            font, font_scale, (0, 0, 0), thickness,
        )

    return annotated

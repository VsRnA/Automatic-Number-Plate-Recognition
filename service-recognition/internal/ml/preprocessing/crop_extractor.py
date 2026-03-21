import numpy as np

from internal.model.models import BoundingBox
from internal.ml.preprocessing.bbox_utils import expand_to_min_size


def extract_plate_crop(
    frame: np.ndarray,
    bbox: BoundingBox,
    min_w: int = 128,
    min_h: int = 32,
) -> np.ndarray:
    expanded = expand_to_min_size(bbox, frame.shape, min_w=min_w, min_h=min_h)
    x1, y1 = expanded.x, expanded.y
    x2 = expanded.x + expanded.width
    y2 = expanded.y + expanded.height
    return frame[y1:y2, x1:x2]

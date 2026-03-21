import numpy as np


def extract_roi(
    frame: np.ndarray,
    enabled: bool,
    x_pct: float,
    y_pct: float,
    w_pct: float,
    h_pct: float,
) -> tuple[np.ndarray, tuple[int, int]]:
    if not enabled:
        return frame, (0, 0)

    h, w = frame.shape[:2]
    x1 = int(w * x_pct)
    y1 = int(h * y_pct)
    x2 = int(w * (x_pct + w_pct))
    y2 = int(h * (y_pct + h_pct))

    x1 = max(0, min(x1, w - 1))
    y1 = max(0, min(y1, h - 1))
    x2 = max(x1 + 1, min(x2, w))
    y2 = max(y1 + 1, min(y2, h))

    return frame[y1:y2, x1:x2], (x1, y1)

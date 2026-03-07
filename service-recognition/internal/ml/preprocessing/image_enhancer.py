import cv2
import numpy as np


def deskew_plate(crop: np.ndarray) -> np.ndarray:
    """
    Correct small rotation caused by camera angle using the dominant plate contour.
    Only corrects angles in [1.5°, 25°] — outside this range the crop is returned as-is
    to avoid false corrections on noisy or edge-case crops.
    """
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)
    edged = cv2.Canny(blurred, 30, 150)
    contours, _ = cv2.findContours(edged, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return crop

    h, w = crop.shape[:2]
    valid = [c for c in contours if cv2.contourArea(c) > w * h * 0.05]
    if not valid:
        return crop

    largest = max(valid, key=cv2.contourArea)
    angle = cv2.minAreaRect(largest)[2]

    # minAreaRect returns angle in [-90, 0); normalize to small correction
    if angle < -45:
        angle += 90

    if abs(angle) < 1.5 or abs(angle) > 25:
        return crop

    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    return cv2.warpAffine(crop, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def enhance_plate(crop: np.ndarray) -> np.ndarray:
    """Apply CLAHE in LAB space to improve contrast for OCR, especially in poor lighting."""
    lab = cv2.cvtColor(crop, cv2.COLOR_BGR2LAB)
    l_channel, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(4, 4))
    l_enhanced = clahe.apply(l_channel)
    return cv2.cvtColor(cv2.merge([l_enhanced, a, b]), cv2.COLOR_LAB2BGR)

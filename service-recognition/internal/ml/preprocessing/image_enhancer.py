import cv2
import numpy as np


def deskew_plate(crop: np.ndarray) -> np.ndarray:
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

    if angle < -45:
        angle += 90

    if abs(angle) < 1.5 or abs(angle) > 25:
        return crop

    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    return cv2.warpAffine(crop, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def enhance_plate(crop: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)

    # Авто-инверсия: если фон тёмный (ночь, тень) — инвертируем
    # Оцениваем по медиане периметра, а не всего кропа (середина — символы)
    h, w = gray.shape
    border_mask = np.zeros_like(gray)
    border_width = max(2, min(h, w) // 6)
    border_mask[:border_width, :] = 1
    border_mask[-border_width:, :] = 1
    border_mask[:, :border_width] = 1
    border_mask[:, -border_width:] = 1
    border_brightness = float(np.median(gray[border_mask == 1]))
    center_mask = 1 - border_mask
    center_brightness = float(np.median(gray[center_mask == 1]))
    if border_brightness < 60 and center_brightness < 60:
        crop = cv2.bitwise_not(crop)

    # Подавление шума с сохранением краёв символов
    denoised = cv2.bilateralFilter(crop, d=5, sigmaColor=40, sigmaSpace=40)

    # Адаптивный CLAHE: тёмный кадр — сильнее усиливаем контраст
    mean_brightness = float(np.mean(cv2.cvtColor(denoised, cv2.COLOR_BGR2GRAY)))
    clip_limit = 3.5 if mean_brightness < 80 else 2.0

    lab = cv2.cvtColor(denoised, cv2.COLOR_BGR2LAB)
    l_channel, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(4, 4))
    l_enhanced = clahe.apply(l_channel)
    return cv2.cvtColor(cv2.merge([l_enhanced, a, b]), cv2.COLOR_LAB2BGR)

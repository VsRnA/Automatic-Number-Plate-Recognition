import logging
import re
import time
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np

from src.config import settings
from src.domain.models import BoundingBox, PlateResult, RecognitionResult
from src.infrastructure.model_loader import ModelLoader
from src.infrastructure.s3_client import S3Client

logger = logging.getLogger(__name__)

# Символы на номерных знаках РФ (кириллица отображается как латиница в OCR)
# Допустимые буквы: А В Е К М Н О Р С Т У Х → A B E K M H O P C T Y X
PLATE_ALLOWLIST = "ABEKMHOPCTYX0123456789"

# COCO classes для транспорта
VEHICLE_CLASSES = {
    2: 'car',
    3: 'motorcycle',
    5: 'bus',
    7: 'truck'
}


class RecognitionService:
    def __init__(self):
        self._model_loader = ModelLoader()
        self._s3_client = S3Client()
        logger.info("RecognitionService initialized with S3 storage")

    def recognize_from_image(
        self, image_base64: str, use_sample_image: bool
    ) -> RecognitionResult:
        if use_sample_image or not image_base64:
            sample_plate = PlateResult(
                plate_number="A123BC77",
                confidence=0.95,
                bounding_box=BoundingBox(x=100, y=200, width=150, height=50),
            )
            return RecognitionResult(
                success=True,
                plates=[sample_plate],
                processing_time_ms="42",
            )

        return RecognitionResult(
            success=False,
            plates=[],
            processing_time_ms="0",
            error="Image recognition not implemented yet",
        )

    def recognize_from_frame(self, frame: np.ndarray) -> RecognitionResult:
        start_time = time.time()

        try:
            # Шаг 1: Детекция автомобилей
            vehicles = self._detect_vehicles(frame)

            if not vehicles:
                logger.info("No vehicles detected on frame")
                processing_time = int((time.time() - start_time) * 1000)
                return RecognitionResult(
                    success=True,
                    plates=[],
                    processing_time_ms=str(processing_time),
                )

            logger.info(f"Detected {len(vehicles)} vehicles on frame")

            # Фильтруем автомобили по расстоянию (близкие к камере)
            frame_height, frame_width = frame.shape[:2]
            close_vehicles = [
                v for v in vehicles
                if self._is_vehicle_close_enough(v, frame_width, frame_height)
            ]

            if not close_vehicles:
                logger.info(f"No vehicles close enough to barrier (filtered from {len(vehicles)})")
                processing_time = int((time.time() - start_time) * 1000)
                return RecognitionResult(
                    success=True,
                    plates=[],
                    processing_time_ms=str(processing_time),
                )

            logger.info(f"Filtered to {len(close_vehicles)} close vehicles (from {len(vehicles)})")

            # Шаг 2: Crop каждого автомобиля → OCR → сохраняем только если номер найден
            plates = []
            recognized_vehicles = []
            for i, vehicle in enumerate(close_vehicles, 1):
                vehicle_crop = self._crop_vehicle(frame, vehicle)
                if vehicle_crop is None:
                    continue

                plate_result = self._ocr_vehicle_crop(vehicle_crop, vehicle)
                if plate_result:
                    self._save_vehicle_crop(vehicle_crop, vehicle, i, plate_result.plate_number)
                    plates.append(plate_result)
                    recognized_vehicles.append(vehicle)

            # Сохраняем frame только если хотя бы один номер был распознан
            if recognized_vehicles:
                self._save_debug_frame(frame, recognized_vehicles, frame_width, frame_height)

            processing_time = int((time.time() - start_time) * 1000)

            logger.info(f"Recognition complete: {len(plates)} plates found in {processing_time}ms")
            return RecognitionResult(
                success=True,
                plates=plates,
                processing_time_ms=str(processing_time),
            )

        except Exception as e:
            processing_time = int((time.time() - start_time) * 1000)
            logger.error(f"Error during vehicle detection: {e}", exc_info=True)
            return RecognitionResult(
                success=False,
                plates=[],
                processing_time_ms=str(processing_time),
                error=str(e),
            )

    def _is_vehicle_close_enough(
        self, vehicle: dict, frame_width: int, frame_height: int
    ) -> bool:
        """
        Проверяет, достаточно ли близко автомобиль к камере (шлагбауму)

        Фильтрация по:
        1. Площади bbox (% от кадра)
        2. Минимальным размерам (ширина/высота)
        3. Зоне детекции (опционально)
        """
        x1, y1, x2, y2 = vehicle["x1"], vehicle["y1"], vehicle["x2"], vehicle["y2"]
        width = x2 - x1
        height = y2 - y1

        # Проверка минимальных размеров
        if width < settings.min_vehicle_width or height < settings.min_vehicle_height:
            logger.debug(
                f"Vehicle too small: {width}x{height}px "
                f"(min: {settings.min_vehicle_width}x{settings.min_vehicle_height}px)"
            )
            return False

        # Проверка площади bbox
        vehicle_area = width * height
        frame_area = frame_width * frame_height
        area_ratio = vehicle_area / frame_area

        if area_ratio < settings.min_vehicle_area_ratio:
            logger.debug(
                f"Vehicle area too small: {area_ratio:.2%} "
                f"(min: {settings.min_vehicle_area_ratio:.2%})"
            )
            return False

        # Проверка зоны детекции (если задана)
        if settings.detection_zone:
            x1_ratio, y1_ratio, x2_ratio, y2_ratio = settings.detection_zone
            zone_x1 = int(frame_width * x1_ratio)
            zone_y1 = int(frame_height * y1_ratio)
            zone_x2 = int(frame_width * x2_ratio)
            zone_y2 = int(frame_height * y2_ratio)

            # Проверяем, что центр автомобиля в зоне
            center_x = (x1 + x2) // 2
            center_y = (y1 + y2) // 2

            if not (zone_x1 <= center_x <= zone_x2 and zone_y1 <= center_y <= zone_y2):
                logger.debug(
                    f"Vehicle outside detection zone: center ({center_x}, {center_y})"
                )
                return False

        logger.debug(
            f"Vehicle passed filters: {width}x{height}px, area {area_ratio:.2%}"
        )
        return True

    def _detect_vehicles(self, frame: np.ndarray) -> list[dict]:
        """
        Детекция автомобилей на кадре через YOLO

        Returns:
            List of vehicle detections with bbox, confidence, and class
        """
        try:
            model = self._model_loader.get_yolo_model(settings.yolo_model_path)
            results = model(frame, verbose=False)

            vehicles = []
            for result in results:
                boxes = result.boxes
                for box in boxes:
                    cls = int(box.cls[0])

                    # Фильтруем только транспорт
                    if cls not in VEHICLE_CLASSES:
                        continue

                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    confidence = float(box.conf[0])

                    vehicle = {
                        "x1": int(x1),
                        "y1": int(y1),
                        "x2": int(x2),
                        "y2": int(y2),
                        "confidence": confidence,
                        "class": cls,
                        "class_name": VEHICLE_CLASSES[cls],
                    }
                    vehicles.append(vehicle)

            logger.debug(f"YOLO detected {len(vehicles)} vehicles")
            return vehicles

        except Exception as e:
            logger.error(f"Vehicle detection failed: {e}", exc_info=True)
            return []

    def _crop_vehicle(self, frame: np.ndarray, vehicle: dict) -> np.ndarray | None:
        """
        Crop автомобиля из кадра

        Args:
            frame: Оригинальный кадр
            vehicle: Данные детекции автомобиля

        Returns:
            Crop автомобиля или None если crop пустой
        """
        try:
            x1 = vehicle["x1"]
            y1 = vehicle["y1"]
            x2 = vehicle["x2"]
            y2 = vehicle["y2"]

            # Проверяем границы
            frame_height, frame_width = frame.shape[:2]
            x1 = max(0, x1)
            y1 = max(0, y1)
            x2 = min(frame_width, x2)
            y2 = min(frame_height, y2)

            crop = frame[y1:y2, x1:x2]

            if crop.size == 0:
                logger.warning("Empty vehicle crop")
                return None

            return crop

        except Exception as e:
            logger.error(f"Failed to crop vehicle: {e}", exc_info=True)
            return None

    def _save_debug_frame(
        self, frame: np.ndarray, vehicles: list[dict],
        frame_width: int, frame_height: int
    ):
        """
        Сохранение кадра с разметкой автомобилей и зоны детекции в S3
        """
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
            annotated_frame = frame.copy()

            # Рисуем зону детекции (если задана)
            if settings.detection_zone:
                x1_ratio, y1_ratio, x2_ratio, y2_ratio = settings.detection_zone
                zone_x1 = int(frame_width * x1_ratio)
                zone_y1 = int(frame_height * y1_ratio)
                zone_x2 = int(frame_width * x2_ratio)
                zone_y2 = int(frame_height * y2_ratio)

                # Полупрозрачный зеленый прямоугольник
                overlay = annotated_frame.copy()
                cv2.rectangle(overlay, (zone_x1, zone_y1), (zone_x2, zone_y2), (0, 255, 0), -1)
                cv2.addWeighted(overlay, 0.2, annotated_frame, 0.8, 0, annotated_frame)

                # Границы зоны
                cv2.rectangle(annotated_frame, (zone_x1, zone_y1), (zone_x2, zone_y2), (0, 255, 0), 2)
                cv2.putText(
                    annotated_frame, "Detection Zone", (zone_x1 + 10, zone_y1 + 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2
                )

            # Рисуем bbox для каждого автомобиля (зеленый = близкие)
            for vehicle in vehicles:
                x1 = vehicle["x1"]
                y1 = vehicle["y1"]
                x2 = vehicle["x2"]
                y2 = vehicle["y2"]
                confidence = vehicle["confidence"]
                class_name = vehicle["class_name"]

                # Зеленый bbox (прошедшие фильтр)
                color = (0, 255, 0)
                cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 3)

                # Добавляем текст с размерами
                width = x2 - x1
                height = y2 - y1
                area_ratio = (width * height) / (frame_width * frame_height)
                label = f"{class_name} {confidence:.2f} | {width}x{height} ({area_ratio:.1%})"
                cv2.putText(
                    annotated_frame, label, (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2
                )

            # Конвертируем в байты
            success, buffer = cv2.imencode('.jpg', annotated_frame)
            if not success:
                logger.error("Failed to encode frame to JPEG")
                return

            # Загружаем в S3
            file_name = f"frame_{timestamp}.jpg"
            file_url = self._s3_client.upload_file(
                file_data=buffer.tobytes(),
                file_name=file_name,
                content_type="image/jpeg"
            )

            if file_url:
                logger.info(f"Debug frame uploaded to S3: {file_url}")
            else:
                logger.error("Failed to upload debug frame to S3")

        except Exception as e:
            logger.error(f"Failed to save debug frame: {e}", exc_info=True)

    def _save_vehicle_crop(self, crop: np.ndarray, vehicle: dict, index: int, plate_number: str):
        """
        Сохранение crop'а автомобиля в S3
        """
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
            class_name = vehicle["class_name"]

            # Конвертируем в байты
            success, buffer = cv2.imencode('.jpg', crop)
            if not success:
                logger.error("Failed to encode vehicle crop to JPEG")
                return

            # Загружаем в S3
            file_name = f"vehicle_{plate_number}_{timestamp}_{index}_{class_name}.jpg"
            file_url = self._s3_client.upload_file(
                file_data=buffer.tobytes(),
                file_name=file_name,
                content_type="image/jpeg"
            )

            if file_url:
                logger.info(f"Vehicle crop uploaded to S3: {file_url}")
            else:
                logger.error("Failed to upload vehicle crop to S3")

        except Exception as e:
            logger.error(f"Failed to save vehicle crop: {e}", exc_info=True)

    def _preprocess_for_ocr(self, image: np.ndarray) -> list[np.ndarray]:
        """
        Возвращает несколько вариантов предобработки изображения для OCR.

        Пробуем разные варианты, чтобы увеличить шанс успешного распознавания
        при разных условиях освещения.
        """
        variants = []

        # Grayscale
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image.copy()

        # Апскейл если изображение маленькое (номер должен быть ~100px шириной)
        _, w = gray.shape[:2]
        if w < 400:
            scale = 400 / w
            gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

        # Вариант 1: CLAHE (контрастирование)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        clahe_img = clahe.apply(gray)
        sharpen_kernel = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]])
        sharpened = cv2.filter2D(clahe_img, -1, sharpen_kernel)
        variants.append(sharpened)

        # Вариант 2: Adaptive threshold (работает при неравномерном освещении)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        adaptive = cv2.adaptiveThreshold(
            blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
        )
        variants.append(adaptive)

        # Вариант 3: Otsu binarization
        _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        variants.append(otsu)

        return variants

    def _find_plate_candidates(self, crop: np.ndarray) -> list[np.ndarray]:
        """
        Ищет кандидатов на номерной знак РФ внутри crop автомобиля.

        Стратегии (в порядке приоритета):
        1. Цветовая фильтрация белых/светлых прямоугольников (номера РФ — белый фон)
        2. Canny + contours с более мягкими порогами
        3. Фиксированные субрегионы нижней части crop (номер обычно там)
        """
        crop_h, crop_w = crop.shape[:2]
        candidates = []

        try:
            # --- Стратегия 1: Цветовая фильтрация белого прямоугольника ---
            if len(crop.shape) == 3:
                hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
                # Белый цвет в HSV: низкая насыщенность, высокая яркость
                white_mask = cv2.inRange(hsv, (0, 0, 180), (180, 50, 255))
            else:
                _, white_mask = cv2.threshold(crop, 180, 255, cv2.THRESH_BINARY)

            # Морфология: закрываем дыры внутри белой области
            close_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (20, 5))
            white_mask = cv2.morphologyEx(white_mask, cv2.MORPH_CLOSE, close_kernel)

            contours, _ = cv2.findContours(
                white_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
            )
            for contour in contours:
                x, y, w, h = cv2.boundingRect(contour)
                if h == 0:
                    continue
                aspect = w / h
                if not (2.5 <= aspect <= 8.0):
                    continue
                if w < 60 or h < 15:
                    continue
                # Номер обычно в нижних 2/3 crop'а
                if y < crop_h * 0.2:
                    continue
                region = crop[y:y + h, x:x + w]
                if region.size > 0:
                    candidates.append((region, w * h, "white_filter"))

            # --- Стратегия 2: Canny с мягкими порогами ---
            if len(crop.shape) == 3:
                gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
            else:
                gray = crop.copy()

            blurred = cv2.GaussianBlur(gray, (5, 5), 0)
            for low, high in [(30, 100), (50, 150), (80, 200)]:
                edges = cv2.Canny(blurred, low, high)
                kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 3))
                edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)

                contours, _ = cv2.findContours(
                    edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
                )
                for contour in contours:
                    x, y, w, h = cv2.boundingRect(contour)
                    if h == 0:
                        continue
                    aspect = w / h
                    if not (2.5 <= aspect <= 8.0):
                        continue
                    if w < 60 or h < 15:
                        continue
                    if y < crop_h * 0.2:
                        continue
                    region = crop[y:y + h, x:x + w]
                    if region.size > 0:
                        candidates.append((region, w * h, f"canny_{low}_{high}"))

            # --- Стратегия 3: Фиксированные субрегионы нижней части ---
            # Номер РФ обычно занимает ~нижние 30% высоты автомобиля
            for y_start_ratio in (0.55, 0.65, 0.70, 0.75):
                y_start = int(crop_h * y_start_ratio)
                sub = crop[y_start:crop_h, 0:crop_w]
                if sub.size > 0:
                    candidates.append((sub, sub.shape[0] * sub.shape[1], "bottom_strip"))

            # Убираем дубли, сортируем по площади (от меньшего — точнее кроп)
            candidates.sort(key=lambda c: c[1])
            unique = []
            seen_areas = set()
            for region, area, source in candidates:
                if area not in seen_areas:
                    seen_areas.add(area)
                    unique.append((region, source))

            result = [r[0] for r in unique[:8]]
            sources = [r[1] for r in unique[:8]]
            logger.debug(
                f"Found {len(result)} plate candidates: {sources}"
            )
            return result

        except Exception as e:
            logger.error(f"Plate candidate search failed: {e}", exc_info=True)
            return []

    def _run_ocr_on_image(
        self, reader, image: np.ndarray
    ) -> tuple[str, float] | None:
        """
        Запускает OCR на одном изображении (и его предобработанных вариантах).

        Returns:
            (normalized_text, confidence) или None
        """
        variants = self._preprocess_for_ocr(image)

        for i, variant in enumerate(variants):
            try:
                results = reader.readtext(variant, allowlist=PLATE_ALLOWLIST)
                if not results:
                    logger.debug(f"OCR variant {i}: no text found")
                    continue

                all_texts = [(r[1], round(r[2], 2)) for r in results]
                logger.debug(f"OCR variant {i}: raw results = {all_texts}")

                best = max(results, key=lambda r: r[2])
                text, confidence = best[1], best[2]
                normalized = self._normalize_plate_text(text)

                if normalized:
                    return normalized, confidence

                logger.debug(f"OCR variant {i}: best text {text!r} did not match plate format")

            except Exception as e:
                logger.debug(f"OCR variant {i} failed: {e}")
                continue

        return None

    def _ocr_vehicle_crop(
        self, crop: np.ndarray, vehicle: dict
    ) -> PlateResult | None:
        """
        OCR на crop автомобиля:
        1. Сначала ищем кандидатов на номер через CV (прямоугольники с нужным aspect ratio)
        2. OCR на каждом кандидате с предобработкой
        3. Fallback: OCR на всём crop с предобработкой
        """
        try:
            reader = self._model_loader.get_ocr_reader(
                languages=settings.ocr_languages, gpu=settings.ocr_gpu
            )

            # Шаг 1: CV-кандидаты на номерной знак
            candidates = self._find_plate_candidates(crop)
            for candidate in candidates:
                result = self._run_ocr_on_image(reader, candidate)
                if result:
                    normalized_text, ocr_confidence = result
                    logger.info(
                        f"OCR detected plate (from candidate): {normalized_text} "
                        f"(confidence: {ocr_confidence:.2f})"
                    )
                    return PlateResult(
                        plate_number=normalized_text,
                        confidence=ocr_confidence,
                        bounding_box=BoundingBox(
                            x=vehicle["x1"],
                            y=vehicle["y1"],
                            width=vehicle["x2"] - vehicle["x1"],
                            height=vehicle["y2"] - vehicle["y1"],
                        ),
                    )

            # Шаг 2: Fallback — OCR на всём crop
            logger.debug("No plate found in candidates, trying full crop OCR")
            result = self._run_ocr_on_image(reader, crop)
            if result:
                normalized_text, ocr_confidence = result
                logger.info(
                    f"OCR detected plate (full crop fallback): {normalized_text} "
                    f"(confidence: {ocr_confidence:.2f})"
                )
                return PlateResult(
                    plate_number=normalized_text,
                    confidence=ocr_confidence,
                    bounding_box=BoundingBox(
                        x=vehicle["x1"],
                        y=vehicle["y1"],
                        width=vehicle["x2"] - vehicle["x1"],
                        height=vehicle["y2"] - vehicle["y1"],
                    ),
                )

            logger.debug("No plate text found in vehicle crop")
            return None

        except Exception as e:
            logger.error(f"OCR on vehicle crop failed: {e}", exc_info=True)
            return None

    def _detect_plates(self, frame: np.ndarray) -> list[dict]:
        try:
            model = self._model_loader.get_yolo_model(settings.yolo_model_path)

            results = model(frame, verbose=False)

            detections = []
            for result in results:
                boxes = result.boxesY
                for box in boxes:
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    confidence = float(box.conf[0])

                    detection = {
                        "x": int(x1),
                        "y": int(y1),
                        "width": int(x2 - x1),
                        "height": int(y2 - y1),
                        "confidence": confidence,
                    }
                    detections.append(detection)

            logger.debug(f"YOLO detected {len(detections)} plates")
            return detections

        except Exception as e:
            logger.error(f"YOLO detection failed: {e}", exc_info=True)
            return []

    def _recognize_plate_text(
        self, frame: np.ndarray, detection: dict
    ) -> PlateResult | None:
        try:
            x = detection["x"]
            y = detection["y"]
            w = detection["width"]
            h = detection["height"]
            yolo_confidence = detection["confidence"]

            frame_height, frame_width = frame.shape[:2]
            x = max(0, x)
            y = max(0, y)
            w = min(w, frame_width - x)
            h = min(h, frame_height - y)

            plate_crop = frame[y : y + h, x : x + w]

            if plate_crop.size == 0:
                logger.warning("Empty plate crop, skipping OCR")
                return None

            reader = self._model_loader.get_ocr_reader(
                languages=settings.ocr_languages, gpu=settings.ocr_gpu
            )

            results = reader.readtext(plate_crop)

            if not results:
                logger.debug("No text detected by OCR")
                return None

            best_result = max(results, key=lambda r: r[2])
            text = best_result[1]
            ocr_confidence = best_result[2]

            normalized_text = self._normalize_plate_text(text)

            if not normalized_text:
                logger.debug(f"Text normalization failed for: {text}")
                return None

            combined_confidence = yolo_confidence * ocr_confidence

            return PlateResult(
                plate_number=normalized_text,
                confidence=combined_confidence,
                bounding_box=BoundingBox(x=x, y=y, width=w, height=h),
            )

        except Exception as e:
            logger.error(f"OCR recognition failed: {e}", exc_info=True)
            return None

    # Символы, которые OCR путает в зависимости от позиции
    # На позиции буквы: цифра → буква
    _DIGIT_TO_LETTER = {'0': 'O', '1': 'T', '4': 'A', '8': 'B', '3': 'E', '6': 'C'}
    # На позиции цифры: буква → цифра
    _LETTER_TO_DIGIT = {'O': '0', 'T': '1', 'A': '4', 'B': '8', 'E': '3', 'C': '6', 'I': '1'}

    def _apply_positional_corrections(self, text: str) -> str:
        """
        Применяет позиционную коррекцию символов для формата РФ номера.

        Формат: [L] [D D D] [L L] [D D (D)]
        На позициях букв: 4→A, 0→O, 1→T, 8→B, 3→E
        На позициях цифр: O→0, A→4, B→8, E→3, I→1

        Пример: '49651043' → 'A965TO43'
        """
        if len(text) not in (8, 9):
            return text

        chars = list(text)

        # Позиция 0: должна быть буква
        if chars[0].isdigit():
            chars[0] = self._DIGIT_TO_LETTER.get(chars[0], chars[0])

        # Позиции 1-3: должны быть цифры
        for i in range(1, 4):
            if chars[i].isalpha():
                chars[i] = self._LETTER_TO_DIGIT.get(chars[i], chars[i])

        # Позиции 4-5: должны быть буквы
        for i in range(4, 6):
            if chars[i].isdigit():
                chars[i] = self._DIGIT_TO_LETTER.get(chars[i], chars[i])

        # Позиции 6+: должны быть цифры (код региона)
        for i in range(6, len(chars)):
            if chars[i].isalpha():
                chars[i] = self._LETTER_TO_DIGIT.get(chars[i], chars[i])

        return ''.join(chars)

    def _normalize_plate_text(self, text: str) -> str:
        normalized = text.upper().replace(" ", "")
        normalized = re.sub(r"[^A-Z0-9]", "", normalized)

        # Стандартный формат РФ: А123ВС77 или А123ВС777 (регион 3 цифры)
        # OCR читает кириллические буквы-двойники как латинские (A=А, B=В, E=Е и т.д.)
        if re.fullmatch(r"[ABEKMHOPCTYX]\d{3}[ABEKMHOPCTYX]{2}\d{2,3}", normalized):
            return normalized

        # Пробуем позиционную коррекцию символов (4→A, 0→O, 1→T и т.д.)
        corrected = self._apply_positional_corrections(normalized)
        if corrected != normalized:
            logger.debug(f"Trying positional correction: {normalized!r} → {corrected!r}")
            if re.fullmatch(r"[ABEKMHOPCTYX]\d{3}[ABEKMHOPCTYX]{2}\d{2,3}", corrected):
                return corrected

        logger.debug(f"Text does not match RU plate format: {normalized!r}")
        return ""

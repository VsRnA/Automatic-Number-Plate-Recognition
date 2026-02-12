import logging
from threading import Lock
from typing import Optional

logger = logging.getLogger(__name__)


class ModelLoader:
    _instance: Optional["ModelLoader"] = None
    _init_lock = Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._init_lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        with self._init_lock:
            if self._initialized:
                return

            self._yolo_model = None
            self._ocr_reader = None
            self._yolo_lock = Lock()
            self._ocr_lock = Lock()
            self._initialized = True

            logger.info("ModelLoader singleton initialized")

    def get_yolo_model(self, model_path: str = "yolov8n.pt"):
        if self._yolo_model is None:
            with self._yolo_lock:
                if self._yolo_model is None:
                    logger.info(f"Loading YOLO model from {model_path}")
                    try:
                        from ultralytics import YOLO

                        self._yolo_model = YOLO(model_path)
                        logger.info("YOLO model loaded successfully")
                    except Exception as e:
                        logger.error(f"Failed to load YOLO model: {e}")
                        raise

        return self._yolo_model

    def get_ocr_reader(self, languages: list[str] = None, gpu: bool = True):
        if languages is None:
            languages = ["en", "ru"]

        if self._ocr_reader is None:
            with self._ocr_lock:
                if self._ocr_reader is None:
                    logger.info(f"Loading EasyOCR reader for languages: {languages}")
                    try:
                        import easyocr

                        self._ocr_reader = easyocr.Reader(languages, gpu=gpu)
                        logger.info("EasyOCR reader loaded successfully")
                    except Exception as e:
                        logger.error(f"Failed to load EasyOCR reader: {e}")
                        raise

        return self._ocr_reader

    def unload_models(self):
        with self._yolo_lock:
            if self._yolo_model is not None:
                del self._yolo_model
                self._yolo_model = None
                logger.info("YOLO model unloaded")

        with self._ocr_lock:
            if self._ocr_reader is not None:
                del self._ocr_reader
                self._ocr_reader = None
                logger.info("EasyOCR reader unloaded")

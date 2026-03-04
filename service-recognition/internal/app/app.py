import logging

from internal.config.config import Settings
from internal.ml.plate_detector import PlateDetector
from internal.ml.vehicle_detector import VehicleDetector
from internal.ml.text_recognizer import TextRecognizer
from internal.service.recognition_service import RecognitionService
from internal.service.worker_manager import WorkerManager
from internal.handler.recognition_handler import RecognitionServicer
from infrastructure.storage.s3_client import S3Client
from infrastructure.storage.redis_producer import RedisProducer
from infrastructure.grpc.server import serve

logger = logging.getLogger(__name__)


def run() -> None:
    settings = Settings()

    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.DEBUG),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    logger.info(f"Starting recognition service on port {settings.grpc_port}")

    vehicle_detector = VehicleDetector(
        model=settings.vehicle_detector_model,
        conf=settings.vehicle_detector_conf,
        imgsz=settings.vehicle_detector_imgsz,
        classes=settings.vehicle_classes,
    )
    plate_detector = PlateDetector(settings.plate_detector_model_path, imgsz=settings.plate_detector_imgsz)
    recognizer = TextRecognizer(settings.crnn_model_path, settings.crnn_device)

    s3 = S3Client(
        endpoint=settings.s3_endpoint,
        access_key=settings.s3_access_key,
        secret_key=settings.s3_secret_key,
        bucket=settings.s3_bucket,
        region=settings.s3_region,
        use_ssl=settings.s3_use_ssl,
    )
    redis = RedisProducer(
        redis_host=settings.redis_host,
        redis_port=settings.redis_port,
        stream_name=settings.redis_stream,
    )

    recognition_service = RecognitionService(
        vehicle_detector=vehicle_detector,
        plate_detector=plate_detector,
        text_recognizer=recognizer,
        s3_client=s3,
        confidence_threshold=settings.confidence_threshold,
        roi_enabled=settings.roi_enabled,
        roi_x_percent=settings.roi_x_percent,
        roi_y_percent=settings.roi_y_percent,
        roi_w_percent=settings.roi_w_percent,
        roi_h_percent=settings.roi_h_percent,
        plate_min_width=settings.plate_min_width,
        plate_min_height=settings.plate_min_height,
    )
    worker_manager = WorkerManager(
        recognition_service=recognition_service,
        redis_producer=redis,
        settings=settings,
    )

    servicer = RecognitionServicer(
        recognition_service=recognition_service,
        worker_manager=worker_manager,
        redis_producer=redis,
    )
    serve(settings.grpc_port, servicer)

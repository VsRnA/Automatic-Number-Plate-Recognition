import logging

from internal.config.config import Settings
from internal.ml.plate_detector import PlateDetector
from internal.ml.text_recognizer import TextRecognizer
from internal.service.recognition_service import RecognitionService
from internal.service.worker_manager import WorkerManager
from internal.handler.recognition_handler import RecognitionServicer
from infrastructure.storage.s3_client import S3Client
from infrastructure.storage.redis_producer import RedisProducer
from infrastructure.grpc.server import serve

logger = logging.getLogger(__name__)


def run() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    settings = Settings()

    logger.info(f"Starting recognition service on port {settings.grpc_port}")

    detector = PlateDetector(settings.plate_detector_model_path)
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
        plate_detector=detector,
        text_recognizer=recognizer,
        s3_client=s3,
        confidence_threshold=settings.confidence_threshold,
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

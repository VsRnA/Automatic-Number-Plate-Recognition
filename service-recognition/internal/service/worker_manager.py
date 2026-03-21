import logging
import threading
from datetime import datetime

from internal.config.config import Settings
from internal.model.worker import Worker, WorkerStatus
from internal.service.recognition_service import RecognitionService
from internal.service.worker_thread import WorkerThread
from infrastructure.storage.redis_producer import RedisProducer

logger = logging.getLogger(__name__)


class WorkerManager:
    def __init__(
        self,
        recognition_service: RecognitionService,
        redis_producer: RedisProducer,
        settings: Settings,
    ):
        self._workers: dict[str, Worker] = {}
        self._threads: dict[str, WorkerThread] = {}
        self._lock = threading.Lock()

        self._recognition_service = recognition_service
        self._redis_producer = redis_producer
        self._settings = settings

    def start_worker(self, camera_id: str, stream: str) -> tuple[bool, str]:
        with self._lock:
            if camera_id in self._workers:
                worker = self._workers[camera_id]
                if worker.status == WorkerStatus.RUNNING:
                    return False, f"Worker for camera {camera_id} is already running"

            worker = Worker(
                camera_id=camera_id,
                stream=stream,
                status=WorkerStatus.RUNNING,
                started_at=datetime.utcnow(),
            )
            self._workers[camera_id] = worker

            thread = WorkerThread(
                worker=worker,
                recognition_service=self._recognition_service,
                redis_producer=self._redis_producer,
                frame_interval=self._settings.frame_interval,
                reconnect_delay=self._settings.worker_reconnect_delay,
                max_retries=self._settings.worker_max_retries,
                tracker_stale_frames=self._settings.tracker_stale_frames,
                tracker_fuzzy_distance=self._settings.tracker_fuzzy_distance,
                tracker_min_iou=self._settings.tracker_min_iou,
                tracker_min_readings=self._settings.tracker_min_readings,
                tracker_cooldown_seconds=self._settings.tracker_cooldown_seconds,
            )
            self._threads[camera_id] = thread
            thread.start()

            logger.info(f"Started worker for camera {camera_id}: {stream}")
            return True, f"Worker started for camera {camera_id}"

    def stop_worker(self, camera_id: str) -> tuple[bool, str]:
        with self._lock:
            if camera_id not in self._workers:
                return False, f"Worker for camera {camera_id} not found"

            worker = self._workers[camera_id]
            if worker.status == WorkerStatus.STOPPED:
                return False, f"Worker for camera {camera_id} is already stopped"

            if camera_id in self._threads:
                thread = self._threads[camera_id]
                thread.stop(timeout=5.0)
                del self._threads[camera_id]

            worker.status = WorkerStatus.STOPPED
            del self._workers[camera_id]

            logger.info(f"Stopped worker for camera {camera_id}")
            return True, f"Worker stopped for camera {camera_id}"

    def get_worker_status(self, camera_id: str) -> Worker | None:
        with self._lock:
            return self._workers.get(camera_id)

    def list_workers(self) -> list[Worker]:
        with self._lock:
            return list(self._workers.values())

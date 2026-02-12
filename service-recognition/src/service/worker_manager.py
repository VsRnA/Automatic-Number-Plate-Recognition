import logging
import threading
from datetime import datetime

from src.config import settings
from src.domain.worker import Worker, WorkerStatus
from src.infrastructure.redis_producer import RedisProducer
from src.service.recognition_service import RecognitionService
from src.worker.worker_thread import WorkerThread

logger = logging.getLogger(__name__)


class WorkerManager:
    """Manages RTSP stream workers for camera recognition."""

    def __init__(self):
        self._workers: dict[str, Worker] = {}
        self._threads: dict[str, WorkerThread] = {}
        self._lock = threading.Lock()

        # Shared services (singleton instances)
        self._recognition_service = RecognitionService()
        self._redis_producer = RedisProducer(
            redis_host=settings.redis_host,
            redis_port=settings.redis_port,
            stream_name=settings.redis_stream,
        )

        logger.info("WorkerManager initialized with shared services")

    def start_worker(self, camera_id: str, rtsp_url: str) -> tuple[bool, str]:
        """
        Start a worker for the given camera.
        Returns (success, message).
        """
        with self._lock:
            if camera_id in self._workers:
                worker = self._workers[camera_id]
                if worker.status == WorkerStatus.RUNNING:
                    return False, f"Worker for camera {camera_id} is already running"

            # Create new worker
            worker = Worker(
                camera_id=camera_id,
                rtsp_url=rtsp_url,
                status=WorkerStatus.RUNNING,
                started_at=datetime.utcnow(),
            )
            self._workers[camera_id] = worker

            # Create and start WorkerThread
            thread = WorkerThread(
                worker=worker,
                recognition_service=self._recognition_service,
                redis_producer=self._redis_producer,
                frame_interval=settings.frame_interval,
                confidence_threshold=settings.confidence_threshold,
                reconnect_delay=settings.worker_reconnect_delay,
                max_retries=settings.worker_max_retries,
            )
            self._threads[camera_id] = thread
            thread.start()

            logger.info(
                f"Started worker for camera {camera_id} with RTSP URL: {rtsp_url}"
            )

            return True, f"Worker started for camera {camera_id}"

    def stop_worker(self, camera_id: str) -> tuple[bool, str]:
        """
        Stop the worker for the given camera.
        Returns (success, message).
        """
        with self._lock:
            if camera_id not in self._workers:
                return False, f"Worker for camera {camera_id} not found"

            worker = self._workers[camera_id]
            if worker.status == WorkerStatus.STOPPED:
                return False, f"Worker for camera {camera_id} is already stopped"

            # Gracefully stop the thread
            if camera_id in self._threads:
                thread = self._threads[camera_id]
                thread.stop(timeout=5.0)
                del self._threads[camera_id]

            # Update worker status and remove from dict
            worker.status = WorkerStatus.STOPPED
            logger.info(f"Stopped worker for camera {camera_id}")
            del self._workers[camera_id]

            return True, f"Worker stopped for camera {camera_id}"

    def get_worker_status(self, camera_id: str) -> Worker | None:
        """Get the status of a worker by camera ID."""
        with self._lock:
            return self._workers.get(camera_id)

    def list_workers(self) -> list[Worker]:
        """List all workers."""
        with self._lock:
            return list(self._workers.values())


# Singleton instance
worker_manager = WorkerManager()

import logging

from src.infrastructure.http_client import BackendHTTPClient
from src.service.worker_manager import worker_manager

logger = logging.getLogger(__name__)


class RecoveryService:
    def __init__(self, backend_url: str):
        self.http_client = BackendHTTPClient(backend_url)

    def recover_workers(self) -> int:
        logger.info("Starting worker recovery...")

        cameras = self.http_client.get_active_cameras()
        if not cameras:
            logger.info("No active cameras found for recovery")
            return 0

        started_count = 0
        for camera in cameras:
            success, message = worker_manager.start_worker(
                camera_id=camera.guid,
                stream=camera.stream,
            )
            if success:
                started_count += 1
                logger.info(f"Recovered worker for camera {camera.name} ({camera.guid})")
            else:
                logger.warning(f"Failed to recover worker for camera {camera.guid}: {message}")

        logger.info(f"Recovery complete: started {started_count} workers")
        return started_count

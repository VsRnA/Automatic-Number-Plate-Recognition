import logging
import socket
import threading
import time
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

import cv2
import numpy as np

from src.domain.worker import Worker, WorkerStatus

logger = logging.getLogger(__name__)


class WorkerThread(threading.Thread):
    def __init__(
        self,
        worker: Worker,
        recognition_service,
        redis_producer,
        frame_interval: int = 30,
        confidence_threshold: float = 0.7,
        reconnect_delay: int = 5,
        max_retries: int = 3,
    ):
        super().__init__(daemon=True)
        self.worker = worker
        self.recognition_service = recognition_service
        self.redis_producer = redis_producer
        self.frame_interval = frame_interval
        self.confidence_threshold = confidence_threshold
        self.reconnect_delay = reconnect_delay
        self.max_retries = max_retries

        self._stop_event = threading.Event()
        self._frame_count = 0

        logger.info(
            f"WorkerThread initialized for camera {worker.camera_id}, "
            f"frame_interval={frame_interval}, confidence={confidence_threshold}"
        )

    def run(self):
        retry_count = 0

        while not self._stop_event.is_set() and retry_count < self.max_retries:
            try:
                logger.info(
                    f"Starting RTSP stream processing for camera {self.worker.camera_id} "
                    f"(attempt {retry_count + 1}/{self.max_retries})"
                )
                self._process_stream()

                if not self._stop_event.is_set():
                    logger.warning(
                        f"RTSP stream ended unexpectedly for camera {self.worker.camera_id}"
                    )
                    retry_count += 1
                    if retry_count < self.max_retries:
                        logger.info(f"Reconnecting in {self.reconnect_delay} seconds...")
                        time.sleep(self.reconnect_delay)
                else:
                    break

            except Exception as e:
                logger.error(
                    f"Error processing RTSP stream for camera {self.worker.camera_id}: {e}",
                    exc_info=True,
                )
                retry_count += 1
                if retry_count < self.max_retries and not self._stop_event.is_set():
                    logger.info(f"Retrying in {self.reconnect_delay} seconds...")
                    time.sleep(self.reconnect_delay)

        if retry_count >= self.max_retries:
            logger.error(
                f"Max retries reached for camera {self.worker.camera_id}, worker stopped"
            )
            self.worker.status = WorkerStatus.ERROR
            self.worker.error = "Max retries reached"

        logger.info(f"WorkerThread stopped for camera {self.worker.camera_id}")

    def _check_rtsp_connectivity(self, url: str, timeout: int = 5) -> bool:
        try:
            parsed = urlparse(url)
            host = parsed.hostname
            port = parsed.port or 8554

            logger.info(f"Testing connectivity to {host}:{port}...")

            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(timeout)
            result = sock.connect_ex((host, port))
            sock.close()

            if result == 0:
                logger.info(f"Successfully connected to {host}:{port}")
                return True
            else:
                logger.error(f"Cannot connect to {host}:{port} (error code: {result})")
                return False
        except Exception as e:
            logger.error(f"Connectivity check failed: {e}")
            return False

    def _process_stream(self):
        cap: Optional[cv2.VideoCapture] = None

        try:
            logger.info(f"Opening RTSP stream: {self.worker.stream}")

            if not self._check_rtsp_connectivity(self.worker.stream):
                raise RuntimeError(
                    f"RTSP server is not reachable. "
                    f"Please check network connectivity and ensure the camera is accessible from this container."
                )

            import os
            os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp|stimeout;10000000"

            cap = cv2.VideoCapture(self.worker.stream, cv2.CAP_FFMPEG)

            if cap is None or not cap.isOpened():
                raise RuntimeError(f"Failed to open RTSP stream: {self.worker.stream}")

            logger.info(f"RTSP stream opened successfully for camera {self.worker.camera_id}")
            self._frame_count = 0
            logger.info(f"Starting frame processing loop for camera {self.worker.camera_id} (interval: every {self.frame_interval} frames)")

            while not self._stop_event.is_set():
                ret, frame = cap.read()

                if not ret:
                    logger.warning(
                        f"Failed to read frame from camera {self.worker.camera_id}"
                    )
                    break

                self._frame_count += 1

                if self._frame_count % 100 == 0:
                    logger.info(f"Processed {self._frame_count} frames for camera {self.worker.camera_id}")

                if self._frame_count % self.frame_interval == 0:
                    try:
                        self._process_frame(frame)
                    except Exception as e:
                        logger.error(
                            f"Error processing frame {self._frame_count} "
                            f"for camera {self.worker.camera_id}: {e}",
                            exc_info=True,
                        )

                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break

        finally:
            if cap is not None:
                cap.release()
                logger.info(f"Released VideoCapture for camera {self.worker.camera_id}")

    def _process_frame(self, frame: np.ndarray):
        logger.debug(
            f"Processing frame {self._frame_count} for camera {self.worker.camera_id}"
        )

        result = self.recognition_service.recognize_from_frame(frame)

        plates_count = len(result.plates) if result.success else 0
        logger.info(
            f"Frame {self._frame_count} recognition result: {plates_count} plates detected"
        )

        if not result.success:
            logger.error(
                f"Recognition failed for camera {self.worker.camera_id}: {result.error}"
            )
            return

        if result.plates:
            for i, plate in enumerate(result.plates, 1):
                logger.info(
                    f"  Plate {i}: '{plate.plate_number}' (confidence: {plate.confidence:.2f})"
                )

        plates = [
            {
                "plate_number": plate.plate_number,
                "confidence": plate.confidence,
                "bounding_box": {
                    "x": plate.bounding_box.x,
                    "y": plate.bounding_box.y,
                    "width": plate.bounding_box.width,
                    "height": plate.bounding_box.height,
                },
            }
            for plate in result.plates
        ]

        filtered_plates = [p for p in plates if p["confidence"] >= self.confidence_threshold]

        logger.info(
            f"Filtered {len(filtered_plates)}/{len(plates)} plates (threshold: {self.confidence_threshold})"
        )

        if filtered_plates:
            logger.info(
                f"Sending {len(filtered_plates)} plates to Redis for camera {self.worker.camera_id} "
                f"(processing time: {result.processing_time_ms}ms)"
            )

            try:
                self.redis_producer.send_recognition_result(
                    camera_id=self.worker.camera_id,
                    plates=filtered_plates,
                    timestamp=datetime.now(timezone.utc),
                )
            except Exception as e:
                logger.error(
                    f"Failed to send result to Redis for camera {self.worker.camera_id}: {e}"
                )

    def stop(self, timeout: float = 5.0):
        logger.info(f"Stopping worker for camera {self.worker.camera_id}")
        self._stop_event.set()
        self.join(timeout)

        if self.is_alive():
            logger.warning(
                f"Worker thread for camera {self.worker.camera_id} did not stop within timeout"
            )

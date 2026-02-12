"""
Worker thread for processing RTSP streams and recognizing license plates.
"""
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
    """Thread for processing RTSP stream from a camera."""

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
        """
        Initialize worker thread.

        Args:
            worker: Worker domain object with camera info
            recognition_service: Service for plate recognition
            redis_producer: Producer for sending results to Redis
            frame_interval: Process every Nth frame (default: 30 = 1fps @ 30fps)
            confidence_threshold: Minimum confidence for detection (default: 0.7)
            reconnect_delay: Seconds to wait before reconnection (default: 5)
            max_retries: Maximum reconnection attempts (default: 3)
        """
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
        """Main thread execution with retry logic."""
        retry_count = 0

        while not self._stop_event.is_set() and retry_count < self.max_retries:
            try:
                logger.info(
                    f"Starting RTSP stream processing for camera {self.worker.camera_id} "
                    f"(attempt {retry_count + 1}/{self.max_retries})"
                )
                self._process_stream()

                # If we reach here, stream ended normally
                if not self._stop_event.is_set():
                    logger.warning(
                        f"RTSP stream ended unexpectedly for camera {self.worker.camera_id}"
                    )
                    retry_count += 1
                    if retry_count < self.max_retries:
                        logger.info(f"Reconnecting in {self.reconnect_delay} seconds...")
                        time.sleep(self.reconnect_delay)
                else:
                    # Normal shutdown
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
        """
        Check if RTSP server is reachable via TCP.

        Args:
            url: RTSP URL
            timeout: Connection timeout in seconds

        Returns:
            True if host:port is reachable, False otherwise
        """
        try:
            parsed = urlparse(url)
            host = parsed.hostname
            port = parsed.port or 8554  # Default RTSP port

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
        """Process RTSP stream with OpenCV."""
        cap: Optional[cv2.VideoCapture] = None

        try:
            logger.info(f"Opening RTSP stream: {self.worker.rtsp_url}")

            # Check network connectivity first
            if not self._check_rtsp_connectivity(self.worker.rtsp_url):
                raise RuntimeError(
                    f"RTSP server is not reachable. "
                    f"Please check network connectivity and ensure the camera is accessible from this container."
                )

            # Set FFmpeg options for RTSP before opening stream
            import os
            os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp|stimeout;10000000"

            # Try multiple methods to open RTSP stream
            methods = [
                # Method 1: Standard VideoCapture with FFmpeg backend and params
                lambda: cv2.VideoCapture(self.worker.rtsp_url, cv2.CAP_FFMPEG, [
                    cv2.CAP_PROP_BUFFERSIZE, 1,
                    cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 10000,
                    cv2.CAP_PROP_READ_TIMEOUT_MSEC, 10000
                ]),
                # Method 2: VideoCapture with FFmpeg backend only
                lambda: cv2.VideoCapture(self.worker.rtsp_url, cv2.CAP_FFMPEG),
                # Method 3: VideoCapture with default backend
                lambda: cv2.VideoCapture(self.worker.rtsp_url),
            ]

            for i, method in enumerate(methods, 1):
                logger.info(f"Trying connection method {i}/{len(methods)}...")
                cap = method()

                if cap.isOpened():
                    logger.info(f"Successfully opened RTSP stream using method {i}")
                    break
                else:
                    logger.warning(f"Method {i} failed to open stream")
                    if cap is not None:
                        cap.release()
                        cap = None

            if cap is None or not cap.isOpened():
                raise RuntimeError(f"Failed to open RTSP stream with all methods: {self.worker.rtsp_url}")

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

                # Log progress every 100 frames
                if self._frame_count % 100 == 0:
                    logger.info(f"Processed {self._frame_count} frames for camera {self.worker.camera_id}")

                # Process only every Nth frame
                if self._frame_count % self.frame_interval == 0:
                    try:
                        self._process_frame(frame)
                    except Exception as e:
                        # Don't stop the worker on frame processing errors
                        logger.error(
                            f"Error processing frame {self._frame_count} "
                            f"for camera {self.worker.camera_id}: {e}",
                            exc_info=True,
                        )

                # Small delay to prevent CPU overload
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break

        finally:
            if cap is not None:
                cap.release()
                logger.info(f"Released VideoCapture for camera {self.worker.camera_id}")

    def _process_frame(self, frame: np.ndarray):
        """
        Process a single frame for plate recognition.

        Args:
            frame: OpenCV frame (numpy array)
        """
        logger.debug(
            f"Processing frame {self._frame_count} for camera {self.worker.camera_id}"
        )

        # Run recognition through YOLO + EasyOCR
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

        # Log detected plates details
        if result.plates:
            for i, plate in enumerate(result.plates, 1):
                logger.info(
                    f"  Plate {i}: '{plate.plate_number}' (confidence: {plate.confidence:.2f})"
                )

        # Convert PlateResult objects to dict format for Redis
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

        # Filter by confidence threshold
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
                # Send to Redis
                self.redis_producer.send_recognition_result(
                    camera_id=self.worker.camera_id,
                    plates=filtered_plates,
                    timestamp=datetime.now(timezone.utc),
                )
            except Exception as e:
                # Fail-soft: log error but continue processing
                logger.error(
                    f"Failed to send result to Redis for camera {self.worker.camera_id}: {e}"
                )

    def stop(self, timeout: float = 5.0):
        """
        Stop the worker thread gracefully.

        Args:
            timeout: Maximum time to wait for thread termination (seconds)
        """
        logger.info(f"Stopping worker for camera {self.worker.camera_id}")
        self._stop_event.set()
        self.join(timeout)

        if self.is_alive():
            logger.warning(
                f"Worker thread for camera {self.worker.camera_id} did not stop within timeout"
            )

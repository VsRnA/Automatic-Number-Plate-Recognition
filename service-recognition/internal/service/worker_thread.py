import logging
import socket
import threading
import time
from collections import Counter, deque
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

import cv2
import numpy as np

from internal.model.models import PlateResult
from internal.model.worker import Worker, WorkerStatus

logger = logging.getLogger(__name__)


class PlateVotingBuffer:
    def __init__(self, min_votes: int = 3, buffer_size: int = 10, stale_frames: int = 10):
        self.min_votes = min_votes
        self._readings: deque[str] = deque(maxlen=buffer_size)
        self._stale_frames = stale_frames
        self._frames_without_reading = 0
        self._last_sent: str | None = None

    def on_frame(self, plate: str | None) -> tuple[str, float] | None:
        if plate is None:
            self._frames_without_reading += 1
            if self._frames_without_reading >= self._stale_frames:
                self._readings.clear()
                self._last_sent = None
                self._frames_without_reading = 0
            return None

        self._frames_without_reading = 0
        self._readings.append(plate)

        if len(self._readings) < self.min_votes:
            return None

        voted = self._vote()
        if voted and voted[0] != self._last_sent:
            self._last_sent = voted[0]
            logger.info(f"PlateVotingBuffer: confirmed → {voted[0]!r} (ratio={voted[1]:.0%})")
            return voted

        return None

    def flush(self) -> tuple[str, float] | None:
        """Return best available result ignoring min_votes — for end-of-video flush."""
        if not self._readings:
            return None
        result = self._majority_vote(list(self._readings))
        if result is None or result[0] == self._last_sent:
            return None
        return result

    def _vote(self) -> tuple[str, float] | None:
        readings = list(self._readings)
        lengths = Counter(len(r) for r in readings)
        dominant_length = lengths.most_common(1)[0][0]
        same_length = [r for r in readings if len(r) == dominant_length]

        if len(same_length) < self.min_votes:
            return None

        return self._majority_vote(readings)

    def _majority_vote(self, readings: list[str]) -> tuple[str, float] | None:
        lengths = Counter(len(r) for r in readings)
        dominant_length = lengths.most_common(1)[0][0]
        same_length = [r for r in readings if len(r) == dominant_length]

        result = []
        for pos in range(dominant_length):
            chars = [r[pos] for r in same_length]
            voted_char, vote_count = Counter(chars).most_common(1)[0]
            if vote_count * 2 <= len(same_length):
                return None
            result.append(voted_char)

        winner = "".join(result)
        ratio = sum(1 for r in readings if r == winner) / len(readings)
        return winner, ratio


class WorkerThread(threading.Thread):
    def __init__(
        self,
        worker: Worker,
        recognition_service,
        redis_producer,
        frame_interval: int = 30,
        confidence_threshold: float = 0.5,
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
        self._voting_buffer = PlateVotingBuffer(min_votes=3, buffer_size=10, stale_frames=10)

        self._last_detection_frame: Optional[np.ndarray] = None
        self._last_best_plate: Optional[PlateResult] = None

        self._confirmed_times: dict[str, float] = {}
        self._cooldown_seconds: float = 60.0

    def run(self):
        retry_count = 0

        while not self._stop_event.is_set() and retry_count < self.max_retries:
            try:
                logger.info(
                    f"Starting stream for camera {self.worker.camera_id} "
                    f"(attempt {retry_count + 1}/{self.max_retries})"
                )
                self._process_stream()

                if not self._stop_event.is_set():
                    logger.warning(f"Stream ended unexpectedly for camera {self.worker.camera_id}")
                    retry_count += 1
                    if retry_count < self.max_retries:
                        time.sleep(self.reconnect_delay)
                else:
                    break

            except Exception as e:
                logger.error(f"Stream error for camera {self.worker.camera_id}: {e}", exc_info=True)
                retry_count += 1
                if retry_count < self.max_retries and not self._stop_event.is_set():
                    time.sleep(self.reconnect_delay)

        if retry_count >= self.max_retries:
            logger.error(f"Max retries reached for camera {self.worker.camera_id}")
            self.worker.status = WorkerStatus.ERROR
            self.worker.error = "Max retries reached"

        logger.info(f"WorkerThread stopped for camera {self.worker.camera_id}")

    def _check_rtsp_connectivity(self, url: str, timeout: int = 5) -> bool:
        parsed = urlparse(url)
        host = parsed.hostname
        port = parsed.port or 554

        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((host, port))
        sock.close()

        if result != 0:
            logger.error(f"RTSP not reachable: {host}:{port} (code {result})")
            return False

        return True

    def _process_stream(self):
        cap: Optional[cv2.VideoCapture] = None
        try:
            if not self._check_rtsp_connectivity(self.worker.stream):
                raise RuntimeError(f"RTSP server not reachable: {self.worker.stream}")

            import os
            os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp|stimeout;10000000"
            cap = cv2.VideoCapture(self.worker.stream, cv2.CAP_FFMPEG)

            if not cap.isOpened():
                raise RuntimeError(f"Failed to open RTSP stream: {self.worker.stream}")

            logger.info(f"Stream opened for camera {self.worker.camera_id}")
            self._frame_count = 0

            while not self._stop_event.is_set():
                ret, frame = cap.read()
                if not ret:
                    logger.warning(f"Failed to read frame from camera {self.worker.camera_id}")
                    break

                self._frame_count += 1

                if self._frame_count % self.frame_interval == 0:
                    self._process_frame(frame)
        finally:
            if cap is not None:
                cap.release()

    def _process_frame(self, frame: np.ndarray):
        result = self.recognition_service.process_frame(frame)

        best_plate: Optional[PlateResult] = None
        for plate in result.plates:
            if plate.confidence >= self.confidence_threshold:
                if best_plate is None or plate.confidence > best_plate.confidence:
                    best_plate = plate

        if best_plate:
            self._last_detection_frame = frame.copy()
            self._last_best_plate = best_plate

        voted = self._voting_buffer.on_frame(best_plate.plate_number if best_plate else None)

        if voted is None:
            return

        voted_plate, vote_confidence = voted

        now = time.time()
        last_confirmed = self._confirmed_times.get(voted_plate, 0.0)
        if now - last_confirmed < self._cooldown_seconds:
            logger.debug(f"Camera {self.worker.camera_id}: plate {voted_plate!r} in cooldown, skipping")
            return
        self._confirmed_times[voted_plate] = now

        screenshot_url: str | None = None
        if self._last_detection_frame is not None and self._last_best_plate is not None:
            try:
                screenshot_url = self.recognition_service.save_screenshot(
                    self._last_detection_frame, [self._last_best_plate]
                )
            except Exception:
                logger.warning(f"Screenshot save failed for camera {self.worker.camera_id}")

        logger.info(
            f"Camera {self.worker.camera_id}: confirmed '{voted_plate}', screenshot={screenshot_url}"
        )

        plates_payload = [{
            "plate_number": voted_plate,
            "confidence": vote_confidence,
            "screenshot_url": screenshot_url or "",
            "bounding_box": {
                "x": self._last_best_plate.bounding_box.x,
                "y": self._last_best_plate.bounding_box.y,
                "width": self._last_best_plate.bounding_box.width,
                "height": self._last_best_plate.bounding_box.height,
            } if self._last_best_plate else {},
        }]

        self.redis_producer.send_recognition_result(
            camera_id=self.worker.camera_id,
            plates=plates_payload,
            timestamp=datetime.now(timezone.utc),
        )

    def stop(self, timeout: float = 5.0):
        self._stop_event.set()
        self.join(timeout)
        if self.is_alive():
            logger.warning(f"Worker thread did not stop within {timeout}s for camera {self.worker.camera_id}")

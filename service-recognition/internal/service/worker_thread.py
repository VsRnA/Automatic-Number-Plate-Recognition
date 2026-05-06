import concurrent.futures
import logging
import os
import socket
import threading
import time
import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse

import cv2
import numpy as np

from internal.ml.preprocessing.zone_mask import apply_zone_mask
from internal.model.models import BoundingBox, PlateResult
from internal.model.worker import Worker, WorkerStatus
from internal.model.zone import WorkerZoneConfig
from internal.tracking.tracker import ConfirmedDetection, Tracker

logger = logging.getLogger(__name__)


class WorkerThread(threading.Thread):
    def __init__(
        self,
        worker: Worker,
        recognition_service,
        redis_producer,
        frame_interval: int = 2,
        reconnect_delay: int = 5,
        max_retries: int = 3,
        tracker_stale_frames: int = 15,
        tracker_fuzzy_distance: int = 1,
        tracker_min_iou: float = 0.3,
        tracker_min_readings: int = 2,
        tracker_cooldown_seconds: float = 30.0,
        tracker_text_match_enabled: bool = False,
        zone: WorkerZoneConfig | None = None,
    ):
        super().__init__(daemon=True)
        self.worker = worker
        self.recognition_service = recognition_service
        self.redis_producer = redis_producer
        self.frame_interval = frame_interval
        self.reconnect_delay = reconnect_delay
        self.max_retries = max_retries

        self._zone = zone
        self._stop_event = threading.Event()
        self._frame_count = 0
        self._detection_executor = concurrent.futures.ThreadPoolExecutor(
            max_workers=2,
            thread_name_prefix=f"detect-{worker.camera_id[:8]}",
        )
        self._upload_executor = concurrent.futures.ThreadPoolExecutor(
            max_workers=4,
            thread_name_prefix=f"s3-upload-{worker.camera_id[:8]}",
        )

        self._tracker = Tracker(
            stale_frames=tracker_stale_frames,
            fuzzy_distance=tracker_fuzzy_distance,
            min_iou=tracker_min_iou,
            min_readings=tracker_min_readings,
            cooldown_seconds=tracker_cooldown_seconds,
            text_match_enabled=tracker_text_match_enabled,
        )

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
        cap: cv2.VideoCapture | None = None
        try:
            if not self._check_rtsp_connectivity(self.worker.stream):
                raise RuntimeError(f"RTSP server not reachable: {self.worker.stream}")

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
        if self._zone is not None:
            frame = apply_zone_mask(frame, self._zone)

        detections = self.recognition_service.process_frame(frame)

        if self._zone is not None and (self._zone.min_plate_rel > 0 or self._zone.max_plate_rel < 1):
            fh = frame.shape[0]
            min_px = int(self._zone.min_plate_rel * fh)
            max_px = int(self._zone.max_plate_rel * fh)
            detections = [
                d for d in detections
                if min_px <= d.plate.bbox.height <= max_px
            ]

        confirmed_list = self._tracker.update(detections)
        for confirmed in confirmed_list:
            future = self._upload_executor.submit(self._publish_confirmed, confirmed)
            future.add_done_callback(self._on_publish_done)

    def _publish_confirmed(self, confirmed: ConfirmedDetection):
        frame = confirmed.best_frame
        plate_bbox = confirmed.plate_bbox
        vehicle_bbox = confirmed.vehicle_bbox

        if frame is None:
            logger.warning(
                f"Camera {self.worker.camera_id}: confirmed '{confirmed.plate_text}' "
                f"but no best frame — skipping save"
            )
            return

        camera_id = self.worker.camera_id
        event_id = str(uuid.uuid4())

        plate_result = PlateResult(
            plate_number=confirmed.plate_text,
            confidence=confirmed.confidence,
            bounding_box=plate_bbox,
        )

        screenshot_url: str | None = None
        car_crop_url: str | None = None
        plate_crop_url: str | None = None

        try:
            screenshot_url = self.recognition_service.save_screenshot(frame, plate_result, plate_bbox, camera_id, event_id)
        except Exception:
            logger.warning(f"Screenshot save failed for camera {camera_id}")

        if vehicle_bbox is not None:
            try:
                car_crop_url = self.recognition_service.save_car_crop(frame, vehicle_bbox, confirmed.plate_text, camera_id, event_id)
            except Exception:
                logger.warning(f"Car crop save failed for camera {camera_id}")

        try:
            plate_crop_url = self.recognition_service.save_plate_crop(frame, plate_bbox, confirmed.plate_text, camera_id, event_id)
        except Exception:
            logger.warning(f"Plate crop save failed for camera {camera_id}")

        logger.info(
            f"Camera {camera_id}: confirmed plate '{confirmed.plate_text}' "
            f"(conf={confirmed.confidence:.2f}), screenshot={screenshot_url}"
        )

        self.redis_producer.send_recognition_result(
            camera_id=camera_id,
            plates=[{
                "plate_number": confirmed.plate_text,
                "confidence": confirmed.confidence,
                "screenshot_url": screenshot_url or "",
                "car_crop_url": car_crop_url or "",
                "plate_crop_url": plate_crop_url or "",
                "bounding_box": {
                    "x": plate_bbox.x,
                    "y": plate_bbox.y,
                    "width": plate_bbox.width,
                    "height": plate_bbox.height,
                },
            }],
            timestamp=datetime.now(timezone.utc),
        )

    def _on_publish_done(self, future: concurrent.futures.Future) -> None:
        try:
            future.result()
        except Exception as e:
            logger.error(
                f"Camera {self.worker.camera_id}: publish task failed: {e}", exc_info=True
            )

    def stop(self, timeout: float = 5.0):
        self._stop_event.set()
        self.join(timeout)
        if self.is_alive():
            logger.warning(
                f"Worker thread did not stop within {timeout}s for camera {self.worker.camera_id}"
            )

        for confirmed in self._tracker.flush():
            future = self._upload_executor.submit(self._publish_confirmed, confirmed)
            future.add_done_callback(self._on_publish_done)

        self._detection_executor.shutdown(wait=False)
        self._upload_executor.shutdown(wait=True)

import concurrent.futures
import logging
import os
import queue
import socket
import threading
import time
import uuid
from collections import deque
from datetime import datetime, timezone
from urllib.parse import urlparse

import cv2
import numpy as np

from internal.log_context import clear_camera_id, set_camera_id
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
        self.reconnect_delay = reconnect_delay
        self.max_retries = max_retries

        self._zone = zone
        self._stop_event = threading.Event()
        self._fps_timestamps: deque[float] = deque(maxlen=60)
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

    @property
    def fps(self) -> float:
        ts = list(self._fps_timestamps)  # snapshot for thread safety
        if len(ts) < 2:
            return 0.0
        return (len(ts) - 1) / (ts[-1] - ts[0])

    def run(self):
        set_camera_id(self.worker.camera_id)
        try:
            self._run_loop()
        finally:
            clear_camera_id()

    def _run_loop(self):
        retry_count = 0

        while not self._stop_event.is_set() and retry_count < self.max_retries:
            try:
                logger.info(
                    "Starting stream",
                    extra={
                        "camera_id": self.worker.camera_id,
                        "attempt": retry_count + 1,
                        "max_retries": self.max_retries,
                    },
                )
                self._process_stream()

                if not self._stop_event.is_set():
                    logger.warning(
                        "Stream ended unexpectedly",
                        extra={
                            "event": "stream_ended_unexpectedly",
                            "camera_id": self.worker.camera_id,
                            "attempt": retry_count + 1,
                        },
                    )
                    retry_count += 1
                    if retry_count < self.max_retries:
                        time.sleep(self.reconnect_delay)
                else:
                    break

            except Exception as e:
                logger.error(
                    "Stream error",
                    extra={
                        "event": "stream_error",
                        "camera_id": self.worker.camera_id,
                        "error": str(e),
                        "attempt": retry_count + 1,
                    },
                    exc_info=True,
                )
                retry_count += 1
                if retry_count < self.max_retries and not self._stop_event.is_set():
                    logger.warning(
                        "Reconnecting stream",
                        extra={
                            "event": "stream_reconnect",
                            "camera_id": self.worker.camera_id,
                            "attempt": retry_count,
                            "max_retries": self.max_retries,
                            "delay_s": self.reconnect_delay,
                        },
                    )
                    time.sleep(self.reconnect_delay)

        if retry_count >= self.max_retries:
            logger.error(
                "Max retries reached, worker stopping",
                extra={
                    "event": "worker_max_retries",
                    "camera_id": self.worker.camera_id,
                    "max_retries": self.max_retries,
                },
            )
            self.worker.status = WorkerStatus.ERROR
            self.worker.error = "Max retries reached"

        logger.info(
            "WorkerThread stopped",
            extra={"camera_id": self.worker.camera_id},
        )

    def _check_rtsp_connectivity(self, url: str, timeout: int = 5) -> bool:
        parsed = urlparse(url)
        host = parsed.hostname
        port = parsed.port or 554

        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((host, port))
        sock.close()

        if result != 0:
            logger.error(
                "RTSP not reachable",
                extra={
                    "event": "rtsp_unreachable",
                    "camera_id": self.worker.camera_id,
                    "host": host,
                    "port": port,
                    "error_code": result,
                },
            )
            return False

        return True

    def _process_stream(self):
        if not self._check_rtsp_connectivity(self.worker.stream):
            raise RuntimeError(f"RTSP server not reachable: {self.worker.stream}")

        frame_queue: queue.Queue = queue.Queue(maxsize=1)
        stream_error: list[Exception] = []
        processor_done = threading.Event()

        def _read_loop() -> None:
            cap: cv2.VideoCapture | None = None
            try:
                os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp|stimeout;10000000"
                cap = cv2.VideoCapture(self.worker.stream, cv2.CAP_FFMPEG)
                if not cap.isOpened():
                    raise RuntimeError(f"Failed to open RTSP stream: {self.worker.stream}")

                logger.info("Stream opened", extra={"camera_id": self.worker.camera_id})

                while not self._stop_event.is_set() and not processor_done.is_set():
                    ret, frame = cap.read()
                    if not ret:
                        logger.warning(
                            "Failed to read frame",
                            extra={
                                "event": "stream_frame_read_failed",
                                "camera_id": self.worker.camera_id,
                            },
                        )
                        break
                    if frame_queue.full():
                        try:
                            frame_queue.get_nowait()
                        except queue.Empty:
                            pass
                    frame_queue.put_nowait(frame)
            except Exception as exc:
                stream_error.append(exc)
            finally:
                if cap is not None:
                    cap.release()
                try:
                    frame_queue.put_nowait(None)
                except queue.Full:
                    try:
                        frame_queue.get_nowait()
                    except queue.Empty:
                        pass
                    frame_queue.put_nowait(None)

        reader = threading.Thread(
            target=_read_loop,
            daemon=True,
            name=f"reader-{self.worker.camera_id[:8]}",
        )
        reader.start()

        try:
            while not self._stop_event.is_set():
                try:
                    frame = frame_queue.get(timeout=1.0)
                except queue.Empty:
                    continue
                if frame is None:
                    break
                self._process_frame(frame)
        finally:
            processor_done.set()
            reader.join(timeout=5.0)

        if stream_error:
            raise stream_error[0]

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

        self._fps_timestamps.append(time.monotonic())

    def _publish_confirmed(self, confirmed: ConfirmedDetection):
        frame = confirmed.best_frame
        plate_bbox = confirmed.plate_bbox
        vehicle_bbox = confirmed.vehicle_bbox

        if frame is None:
            logger.warning(
                "Confirmed plate has no best frame, skipping save",
                extra={
                    "event": "confirmed_no_frame",
                    "camera_id": self.worker.camera_id,
                    "plate_text": confirmed.plate_text,
                },
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
        except Exception as exc:
            logger.warning(
                "Screenshot save failed",
                extra={
                    "event": "s3_upload_failed",
                    "camera_id": camera_id,
                    "upload_type": "screenshot",
                    "error": str(exc),
                },
                exc_info=True,
            )

        if vehicle_bbox is not None:
            try:
                car_crop_url = self.recognition_service.save_car_crop(frame, vehicle_bbox, confirmed.plate_text, camera_id, event_id)
            except Exception as exc:
                logger.warning(
                    "Car crop save failed",
                    extra={
                        "event": "s3_upload_failed",
                        "camera_id": camera_id,
                        "upload_type": "car_crop",
                        "error": str(exc),
                    },
                    exc_info=True,
                )

        try:
            plate_crop_url = self.recognition_service.save_plate_crop(frame, plate_bbox, confirmed.plate_text, camera_id, event_id)
        except Exception as exc:
            logger.warning(
                "Plate crop save failed",
                extra={
                    "event": "s3_upload_failed",
                    "camera_id": camera_id,
                    "upload_type": "plate_crop",
                    "error": str(exc),
                },
                exc_info=True,
            )

        logger.info(
            "Plate confirmed and published",
            extra={
                "event": "plate_confirmed",
                "camera_id": camera_id,
                "plate_text": confirmed.plate_text,
                "confidence": round(confirmed.confidence, 4),
                "screenshot_url": screenshot_url,
            },
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
                "Publish task failed",
                extra={
                    "event": "publish_task_failed",
                    "camera_id": self.worker.camera_id,
                    "error": str(e),
                },
                exc_info=True,
            )

    def stop(self, timeout: float = 5.0):
        self._stop_event.set()
        self.join(timeout)
        if self.is_alive():
            logger.warning(
                "Worker thread did not stop within timeout",
                extra={
                    "camera_id": self.worker.camera_id,
                    "timeout_s": timeout,
                },
            )

        for confirmed in self._tracker.flush():
            future = self._upload_executor.submit(self._publish_confirmed, confirmed)
            future.add_done_callback(self._on_publish_done)

        self._detection_executor.shutdown(wait=False)
        self._upload_executor.shutdown(wait=True)

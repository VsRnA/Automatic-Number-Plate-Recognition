import logging
import os
import tempfile
from datetime import datetime

import grpc

from infrastructure.grpc.stubs import recognition_pb2, recognition_pb2_grpc
from internal.exception.exceptions import RecognitionError
from internal.model.worker import WorkerStatus
from internal.service.recognition_service import RecognitionService
from internal.service.video_test_service import VideoTestService
from internal.service.worker_manager import WorkerManager

logger = logging.getLogger(__name__)


class RecognitionServicer(recognition_pb2_grpc.RecognitionServiceServicer):
    VERSION = "2.0.0"

    def __init__(self, recognition_service: RecognitionService, worker_manager: WorkerManager):
        self._recognition_service = recognition_service
        self._worker_manager = worker_manager

    def HealthCheck(self, request, context):
        return recognition_pb2.HealthResponse(
            healthy=True,
            version=self.VERSION,
            timestamp=datetime.utcnow().isoformat(),
        )

    def Ping(self, request, context):
        return recognition_pb2.PingResponse(
            message=request.message,
            timestamp=datetime.utcnow().isoformat(),
        )

    def TestRecognize(self, request, context):
        if request.use_sample_image:
            return recognition_pb2.TestRecognizeResponse(
                success=True,
                plates=[recognition_pb2.PlateResult(
                    plate_number="A123BC77",
                    confidence=0.95,
                    bounding_box=recognition_pb2.BoundingBox(x=100, y=200, width=150, height=50),
                )],
                processing_time_ms="1",
            )

        if not request.image_base64:
            return recognition_pb2.TestRecognizeResponse(
                success=False,
                error="Provide image_base64 or set use_sample_image=true",
            )

        try:
            import base64
            import cv2
            import numpy as np

            img_bytes = base64.b64decode(request.image_base64)
            arr = np.frombuffer(img_bytes, dtype=np.uint8)
            frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if frame is None:
                return recognition_pb2.TestRecognizeResponse(
                    success=False, error="Failed to decode image"
                )

            result = self._recognition_service.process_frame(frame)
            plates = [
                recognition_pb2.PlateResult(
                    plate_number=p.plate_number,
                    confidence=p.confidence,
                    bounding_box=recognition_pb2.BoundingBox(
                        x=p.bounding_box.x, y=p.bounding_box.y,
                        width=p.bounding_box.width, height=p.bounding_box.height,
                    ),
                )
                for p in result.plates
            ]
            return recognition_pb2.TestRecognizeResponse(
                success=True,
                plates=plates,
                processing_time_ms=result.processing_time_ms,
            )
        except RecognitionError as e:
            logger.error(f"TestRecognize failed: {e}", exc_info=True)
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            return recognition_pb2.TestRecognizeResponse(success=False, error=str(e))
        except Exception as e:
            logger.error(f"TestRecognize unexpected error: {e}", exc_info=True)
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details("Internal error")
            return recognition_pb2.TestRecognizeResponse(success=False, error="Internal error")

    def TestRecognizeVideo(self, request, context):
        if not request.video_data:
            return recognition_pb2.TestVideoResponse(
                success=False, error="video_data is required"
            )

        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
                tmp.write(request.video_data)
                tmp_path = tmp.name

            frame_interval = request.frame_interval if request.frame_interval > 0 else 30

            video_service = VideoTestService(
                recognition_service=self._recognition_service,
                frame_interval=frame_interval,
            )
            results = video_service.process_video(tmp_path)

            detections = [
                recognition_pb2.VideoPlateDetection(
                    plate_number=p.plate_number,
                    confidence=p.confidence,
                    screenshot_url=r.screenshot_url or "",
                    frame_number=r.frame_number,
                )
                for r in results
                for p in r.plates
            ]

            return recognition_pb2.TestVideoResponse(
                success=True,
                detections=detections,
                total_frames_processed=len(results),
            )
        except RecognitionError as e:
            logger.error(f"TestRecognizeVideo failed: {e}", exc_info=True)
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            return recognition_pb2.TestVideoResponse(success=False, error=str(e))
        except Exception as e:
            logger.error(f"TestRecognizeVideo unexpected error: {e}", exc_info=True)
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details("Internal error")
            return recognition_pb2.TestVideoResponse(success=False, error="Internal error")
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)

    def StartWorker(self, request, context):
        success, message = self._worker_manager.start_worker(request.camera_id, request.stream)
        return recognition_pb2.StartWorkerResponse(
            success=success,
            message=message if success else "",
            error="" if success else message,
        )

    def StopWorker(self, request, context):
        success, message = self._worker_manager.stop_worker(request.camera_id)
        return recognition_pb2.StopWorkerResponse(
            success=success,
            message=message if success else "",
            error="" if success else message,
        )

    def GetWorkerStatus(self, request, context):
        worker = self._worker_manager.get_worker_status(request.camera_id)
        if worker is None:
            return recognition_pb2.GetWorkerStatusResponse(
                camera_id=request.camera_id,
                status=WorkerStatus.STOPPED.value,
                started_at="",
                error="Worker not found",
            )
        return recognition_pb2.GetWorkerStatusResponse(
            camera_id=worker.camera_id,
            status=worker.status.value,
            started_at=worker.started_at.isoformat() if worker.started_at else "",
            error=worker.error,
        )

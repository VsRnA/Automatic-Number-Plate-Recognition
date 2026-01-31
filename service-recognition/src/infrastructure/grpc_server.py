import logging
from concurrent import futures
from datetime import datetime

import grpc

from src.proto import recognition_pb2, recognition_pb2_grpc
from src.service.recognition_service import RecognitionService

logger = logging.getLogger(__name__)


class RecognitionServicer(recognition_pb2_grpc.RecognitionServiceServicer):
    """gRPC servicer implementing recognition methods."""

    VERSION = "1.0.0"

    def __init__(self):
        self.recognition_service = RecognitionService()

    def HealthCheck(self, request, context):
        """Check service health."""
        return recognition_pb2.HealthResponse(
            healthy=True,
            version=self.VERSION,
            timestamp=datetime.utcnow().isoformat(),
        )

    def Ping(self, request, context):
        """Echo back the message for connectivity testing."""
        return recognition_pb2.PingResponse(
            message=request.message,
            timestamp=datetime.utcnow().isoformat(),
        )

    def TestRecognize(self, request, context):
        """Test recognition without RTSP."""
        result = self.recognition_service.recognize_from_image(
            request.image_base64, request.use_sample_image
        )

        plates = [
            recognition_pb2.PlateResult(
                plate_number=p.plate_number,
                confidence=p.confidence,
                bounding_box=recognition_pb2.BoundingBox(
                    x=p.bounding_box.x,
                    y=p.bounding_box.y,
                    width=p.bounding_box.width,
                    height=p.bounding_box.height,
                ),
            )
            for p in result.plates
        ]

        return recognition_pb2.TestRecognizeResponse(
            success=result.success,
            plates=plates,
            processing_time_ms=result.processing_time_ms,
            error=result.error,
        )

    def RecognizeFromRTSP(self, request, context):
        """Start RTSP stream recognition - to be implemented."""
        return recognition_pb2.RecognizeResponse(
            success=False,
            request_id=request.request_id,
            message="",
            error="Not implemented yet",
        )

    def StopRTSPRecognition(self, request, context):
        """Stop RTSP stream recognition - to be implemented."""
        return recognition_pb2.StopRTSPResponse(
            success=False,
            message="",
            error="Not implemented yet",
        )

    def GetRTSPStatus(self, request, context):
        """Get RTSP stream status - to be implemented."""
        return recognition_pb2.RTSPStatusResponse(
            request_id=request.request_id,
            status="unknown",
            frames_processed=0,
            plates_detected=0,
            started_at="",
            error="Not implemented yet",
        )


def serve(port: int) -> None:
    """Start the gRPC server."""
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    recognition_pb2_grpc.add_RecognitionServiceServicer_to_server(
        RecognitionServicer(), server
    )

    server.add_insecure_port(f"[::]:{port}")
    server.start()

    logger.info(f"gRPC server started on port {port}")

    try:
        server.wait_for_termination()
    except KeyboardInterrupt:
        logger.info("Shutting down gRPC server...")
        server.stop(grace=5)

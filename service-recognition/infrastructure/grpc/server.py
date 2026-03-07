import logging
from concurrent import futures

import grpc
from infrastructure.grpc.stubs import recognition_pb2_grpc

logger = logging.getLogger(__name__)


def serve(port: int, servicer) -> None:
    server = grpc.server(
        futures.ThreadPoolExecutor(max_workers=10),
        options=[
            ("grpc.max_receive_message_length", 256 * 1024 * 1024),
            ("grpc.max_send_message_length", 256 * 1024 * 1024),
        ],
    )
    recognition_pb2_grpc.add_RecognitionServiceServicer_to_server(servicer, server)
    server.add_insecure_port(f"[::]:{port}")
    server.start()

    logger.info(f"gRPC server started on port {port}")

    try:
        server.wait_for_termination()
    except KeyboardInterrupt:
        logger.info("Shutting down gRPC server...")
        server.stop(grace=5)

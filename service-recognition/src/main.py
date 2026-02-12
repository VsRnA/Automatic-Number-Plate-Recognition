import logging

from src.config import settings
from src.infrastructure.grpc_server import serve
from src.service.recovery_service import RecoveryService

logger = logging.getLogger(__name__)


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    logger.info(f"Starting recognition service on port {settings.grpc_port}")

    # Recovery: restore workers from Go backend
    logger.info(f"Connecting to Go backend at {settings.go_backend_url}")
    recovery_service = RecoveryService(settings.go_backend_url)
    recovery_service.recover_workers()

    # Start gRPC server
    serve(settings.grpc_port)


if __name__ == "__main__":
    main()

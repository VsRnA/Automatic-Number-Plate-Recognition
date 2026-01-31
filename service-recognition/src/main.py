import logging

from src.config import settings
from src.infrastructure.grpc_server import serve


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    logging.info(f"Starting recognition service on port {settings.grpc_port}")
    serve(settings.grpc_port)


if __name__ == "__main__":
    main()

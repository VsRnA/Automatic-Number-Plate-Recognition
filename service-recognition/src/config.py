from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # gRPC
    grpc_port: int = 50051

    # Go Backend (for recovery)
    go_backend_host: str = "backend"
    go_backend_port: int = 8080

    # Redis
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_stream: str = "recognition:results"

    # S3
    s3_endpoint: str = ""
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_bucket: str = "anpr"
    s3_use_ssl: bool = False
    s3_region: str = "us-east-1"

    # Worker settings
    frame_interval: int = 30  # Process every 30th frame (1fps @ 30fps)
    confidence_threshold: float = 0.7  # Minimum confidence
    worker_reconnect_delay: int = 5  # Seconds before retry
    worker_max_retries: int = 3  # Maximum reconnection attempts

    # Model paths
    yolo_model_path: str = "yolov8n.pt"
    ocr_languages: list[str] = ["en", "ru"]
    ocr_gpu: bool = True

    @property
    def go_backend_url(self) -> str:
        return f"http://{self.go_backend_host}:{self.go_backend_port}"


settings = Settings()

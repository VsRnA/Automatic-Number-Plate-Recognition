from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    grpc_port: int = 50051

    go_backend_host: str = "backend"
    go_backend_port: int = 8080

    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_stream: str = "anpr:results"

    s3_endpoint: str = ""
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_bucket: str = ""
    s3_use_ssl: bool = False
    s3_region: str = ""

    frame_interval: int = 30
    confidence_threshold: float = 0.5
    worker_reconnect_delay: int = 5
    worker_max_retries: int = 3

    plate_detector_model_path: str = "models/yolov8n_plate_detector/best.pt"
    crnn_model_path: str = "models/crnn_number_detector_weights/crnn_plate_best.pth"
    crnn_device: str = "cpu"

    @property
    def go_backend_url(self) -> str:
        return f"http://{self.go_backend_host}:{self.go_backend_port}"

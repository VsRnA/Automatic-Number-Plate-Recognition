from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    log_level: str = "DEBUG"

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

    frame_interval: int = 1
    confidence_threshold: float = 0.5
    worker_reconnect_delay: int = 5
    worker_max_retries: int = 3

    roi_enabled: bool = False
    roi_x_percent: float = 0.1
    roi_y_percent: float = 0.2
    roi_w_percent: float = 0.8
    roi_h_percent: float = 0.6

    vehicle_detector_model: str = "yolov8n"
    vehicle_detector_conf: float = 0.3
    vehicle_detector_imgsz: int = 640
    vehicle_classes: list[int] = [2, 3, 5, 7]

    tracker_stale_frames: int = 15
    tracker_fuzzy_distance: int = 1
    tracker_min_iou: float = 0.3
    tracker_min_readings: int = 3
    tracker_cooldown_seconds: float = 30.0
    tracker_text_match_enabled: bool = False

    plate_min_width: int = 128
    plate_min_height: int = 32

    plate_detector_imgsz: int = 320

    plate_detector_model_path: str = "models/yolov8n_plate_detector/best.pt"
    crnn_model_path: str = "models/crnn_number_detector_weights/crnn_plate_best.pth"
    crnn_device: str = "cpu"

    @property
    def go_backend_url(self) -> str:
        return f"http://{self.go_backend_host}:{self.go_backend_port}"

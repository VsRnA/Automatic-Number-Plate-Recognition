from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # gRPC
    grpc_port: int = 50051

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


settings = Settings()

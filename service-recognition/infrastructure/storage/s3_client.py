import logging
from io import BytesIO

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


class S3Client:
    def __init__(
        self,
        endpoint: str,
        access_key: str,
        secret_key: str,
        bucket: str,
        region: str,
        use_ssl: bool,
    ):
        if not endpoint or not bucket or not access_key or not secret_key:
            logger.warning(
                "S3 client initialized with incomplete configuration",
                extra={
                    "endpoint": endpoint or "<empty>",
                    "bucket": bucket or "<empty>",
                    "access_key_set": bool(access_key),
                    "secret_key_set": bool(secret_key),
                },
            )
        self._bucket = bucket
        self._use_ssl = use_ssl
        self._endpoint = endpoint
        self._client = boto3.client(
            "s3",
            endpoint_url=endpoint or None,
            aws_access_key_id=access_key or None,
            aws_secret_access_key=secret_key or None,
            region_name=region or None,
            use_ssl=use_ssl,
        )

    def upload_file(self, file_data: bytes, file_name: str, content_type: str = "image/jpeg") -> str:
        try:
            self._client.put_object(
                Bucket=self._bucket,
                Key=file_name,
                Body=file_data,
                ContentType=content_type,
            )
        except Exception:
            logger.exception(
                "S3 put_object failed",
                extra={
                    "bucket": self._bucket,
                    "key": file_name,
                    "endpoint": self._endpoint,
                },
            )
            raise

        protocol = "https" if self._use_ssl else "http"
        clean_endpoint = self._endpoint.replace("https://", "").replace("http://", "")
        return f"{protocol}://{clean_endpoint}/{self._bucket}/{file_name}"

    def upload_from_buffer(self, buffer: BytesIO, file_name: str, content_type: str = "image/jpeg") -> str:
        buffer.seek(0)
        return self.upload_file(buffer.read(), file_name, content_type)

    def file_exists(self, file_name: str) -> bool:
        try:
            self._client.head_object(Bucket=self._bucket, Key=file_name)
            return True
        except ClientError:
            return False

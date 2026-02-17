import logging
from io import BytesIO

import boto3
from botocore.exceptions import ClientError

from src.config import settings

logger = logging.getLogger(__name__)


class S3Client:
    def __init__(self):
        self._client = None
        self._initialize_client()

    def _initialize_client(self):
        """Инициализация S3 клиента"""
        try:
            self._client = boto3.client(
                "s3",
                endpoint_url=settings.s3_endpoint,
                aws_access_key_id=settings.s3_access_key,
                aws_secret_access_key=settings.s3_secret_key,
                region_name=settings.s3_region,
                use_ssl=settings.s3_use_ssl,
            )
            logger.info(
                f"S3 client initialized: endpoint={settings.s3_endpoint}, "
                f"bucket={settings.s3_bucket}"
            )
        except Exception as e:
            logger.error(f"Failed to initialize S3 client: {e}", exc_info=True)
            raise

    def upload_file(self, file_data: bytes, file_name: str, content_type: str = "image/jpeg") -> str | None:
        """
        Загрузка файла в S3

        Args:
            file_data: Данные файла в байтах
            file_name: Имя файла в S3
            content_type: MIME тип файла

        Returns:
            URL файла в S3 или None при ошибке
        """
        try:
            self._client.put_object(
                Bucket=settings.s3_bucket,
                Key=file_name,
                Body=file_data,
                ContentType=content_type,
            )

            # Формируем URL файла
            if settings.s3_use_ssl:
                protocol = "https"
            else:
                protocol = "http"

            file_url = f"{protocol}://{settings.s3_endpoint.replace('https://', '').replace('http://', '')}/{settings.s3_bucket}/{file_name}"

            logger.info(f"File uploaded to S3: {file_url}")
            return file_url

        except ClientError as e:
            logger.error(f"Failed to upload file to S3: {e}", exc_info=True)
            return None
        except Exception as e:
            logger.error(f"Unexpected error uploading to S3: {e}", exc_info=True)
            return None

    def upload_from_buffer(self, buffer: BytesIO, file_name: str, content_type: str = "image/jpeg") -> str | None:
        """
        Загрузка файла из BytesIO буфера

        Args:
            buffer: BytesIO буфер с данными
            file_name: Имя файла в S3
            content_type: MIME тип файла

        Returns:
            URL файла в S3 или None при ошибке
        """
        buffer.seek(0)
        return self.upload_file(buffer.read(), file_name, content_type)

    def file_exists(self, file_name: str) -> bool:
        """
        Проверка существования файла в S3

        Args:
            file_name: Имя файла в S3

        Returns:
            True если файл существует
        """
        try:
            self._client.head_object(Bucket=settings.s3_bucket, Key=file_name)
            return True
        except ClientError:
            return False
        except Exception as e:
            logger.error(f"Error checking file existence: {e}")
            return False

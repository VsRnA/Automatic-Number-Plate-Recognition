"""
Redis producer for sending recognition results to Redis Streams.
"""
import json
import logging
import uuid
from datetime import datetime
from typing import Any

import redis

logger = logging.getLogger(__name__)


class RedisProducer:
    """Redis producer for sending recognition results."""

    def __init__(self, redis_host: str, redis_port: int, stream_name: str):
        """
        Initialize Redis producer.

        Args:
            redis_host: Redis host
            redis_port: Redis port
            stream_name: Name of the Redis Stream
        """
        self.stream_name = stream_name
        self._pool = redis.ConnectionPool(
            host=redis_host,
            port=redis_port,
            decode_responses=False,
            max_connections=10,
        )
        logger.info(
            f"RedisProducer initialized for {redis_host}:{redis_port}, stream: {stream_name}"
        )

    def send_recognition_result(
        self, camera_id: str, plates: list[dict[str, Any]], timestamp: datetime = None
    ) -> str:
        """
        Send recognition result to Redis Stream.

        Args:
            camera_id: Camera UUID
            plates: List of detected plates with format:
                [
                    {
                        "plate_number": "A123BC99",
                        "confidence": 0.95,
                        "bounding_box": {"x": 100, "y": 200, "width": 150, "height": 50}
                    }
                ]
            timestamp: Recognition timestamp (default: current time)

        Returns:
            Message ID from Redis Stream

        Raises:
            redis.RedisError: If Redis operation fails
        """
        if timestamp is None:
            timestamp = datetime.utcnow()

        # Generate unique request ID
        request_id = str(uuid.uuid4())

        # Prepare payload
        payload = {
            "request_id": request_id,
            "camera_id": camera_id,
            "timestamp": timestamp.isoformat(),
            "plates": plates,
        }

        try:
            client = redis.Redis(connection_pool=self._pool)
            message_id = client.xadd(
                self.stream_name, {"data": json.dumps(payload).encode("utf-8")}
            )

            logger.info(
                f"Sent result to Redis: camera={camera_id}, "
                f"plates={len(plates)}, message_id={message_id}"
            )

            return message_id.decode("utf-8") if isinstance(message_id, bytes) else message_id

        except redis.RedisError as e:
            logger.error(f"Failed to send result to Redis: {e}")
            raise

    def ping(self) -> bool:
        """
        Check Redis connection.

        Returns:
            True if connection is successful, False otherwise
        """
        try:
            client = redis.Redis(connection_pool=self._pool)
            return client.ping()
        except redis.RedisError as e:
            logger.error(f"Redis ping failed: {e}")
            return False

    def close(self):
        """Close Redis connection pool."""
        if self._pool:
            self._pool.disconnect()
            logger.info("Redis connection pool closed")

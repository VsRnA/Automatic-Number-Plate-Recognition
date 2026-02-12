import json
import logging
import uuid
from datetime import datetime
from typing import Any

import redis

logger = logging.getLogger(__name__)


class RedisProducer:
    def __init__(self, redis_host: str, redis_port: int, stream_name: str):
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
        if timestamp is None:
            timestamp = datetime.utcnow()

        request_id = str(uuid.uuid4())

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
        try:
            client = redis.Redis(connection_pool=self._pool)
            return client.ping()
        except redis.RedisError as e:
            logger.error(f"Redis ping failed: {e}")
            return False

    def close(self):
        if self._pool:
            self._pool.disconnect()
            logger.info("Redis connection pool closed")

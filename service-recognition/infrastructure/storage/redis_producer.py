import json
import logging
import time
import uuid
from datetime import datetime
from typing import Any

import redis

logger = logging.getLogger(__name__)

_MAX_RETRIES = 3
_RETRY_BASE_DELAY = 1.0


class RedisProducer:
    def __init__(self, redis_host: str, redis_port: int, stream_name: str):
        self.stream_name = stream_name
        self._pool = redis.ConnectionPool(
            host=redis_host,
            port=redis_port,
            decode_responses=False,
            max_connections=10,
        )

    def send_recognition_result(
        self, camera_id: str, plates: list[dict[str, Any]], timestamp: datetime = None
    ) -> str:
        if timestamp is None:
            timestamp = datetime.utcnow()

        payload = {
            "request_id": str(uuid.uuid4()),
            "camera_id": camera_id,
            "timestamp": timestamp.isoformat(),
            "plates": plates,
        }

        data = {"data": json.dumps(payload).encode("utf-8")}
        last_err: Exception | None = None

        for attempt in range(_MAX_RETRIES):
            try:
                client = redis.Redis(connection_pool=self._pool)
                message_id = client.xadd(self.stream_name, data)
                return message_id.decode("utf-8") if isinstance(message_id, bytes) else message_id
            except redis.RedisError as e:
                last_err = e
                if attempt < _MAX_RETRIES - 1:
                    delay = _RETRY_BASE_DELAY * (2**attempt)
                    logger.warning(
                        f"Redis xadd failed (attempt {attempt + 1}/{_MAX_RETRIES}), "
                        f"retrying in {delay:.1f}s: {e}"
                    )
                    time.sleep(delay)

        raise last_err

    def ping(self) -> bool:
        try:
            client = redis.Redis(connection_pool=self._pool)
            return client.ping()
        except redis.RedisError:
            return False

    def close(self):
        if self._pool:
            self._pool.disconnect()

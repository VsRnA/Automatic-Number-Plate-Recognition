import json
import uuid
from datetime import datetime
from typing import Any

import redis


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

        client = redis.Redis(connection_pool=self._pool)
        message_id = client.xadd(
            self.stream_name, {"data": json.dumps(payload).encode("utf-8")}
        )

        return message_id.decode("utf-8") if isinstance(message_id, bytes) else message_id

    def ping(self) -> bool:
        try:
            client = redis.Redis(connection_pool=self._pool)
            return client.ping()
        except redis.RedisError:
            return False

    def close(self):
        if self._pool:
            self._pool.disconnect()

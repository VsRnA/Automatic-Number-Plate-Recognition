#!/usr/bin/env python3
"""
Simple test script to verify Redis connection and producer functionality.
"""
import logging
import sys
from datetime import datetime

sys.path.insert(0, "src")

from src.config import settings
from src.infrastructure.redis_producer import RedisProducer

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)


def test_redis_connection():
    """Test Redis connection and message sending."""
    logger.info("Testing Redis connection...")

    try:
        producer = RedisProducer(
            redis_host=settings.redis_host,
            redis_port=settings.redis_port,
            stream_name=settings.redis_stream,
        )

        # Test ping
        if not producer.ping():
            logger.error("Redis ping failed!")
            return False

        logger.info("✓ Redis connection successful")

        # Test sending a message
        test_plates = [
            {
                "plate_number": "TEST123",
                "confidence": 0.95,
                "bounding_box": {"x": 100, "y": 200, "width": 150, "height": 50},
            }
        ]

        message_id = producer.send_recognition_result(
            camera_id="test-camera-id",
            plates=test_plates,
            timestamp=datetime.utcnow(),
        )

        logger.info(f"✓ Test message sent successfully: {message_id}")
        logger.info(f"Stream name: {settings.redis_stream}")

        producer.close()
        return True

    except Exception as e:
        logger.error(f"Redis test failed: {e}", exc_info=True)
        return False


if __name__ == "__main__":
    success = test_redis_connection()
    sys.exit(0 if success else 1)

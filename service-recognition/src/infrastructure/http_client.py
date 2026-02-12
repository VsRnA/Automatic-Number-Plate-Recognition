import logging
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)


@dataclass
class CameraInfo:
    guid: str
    name: str
    rtsp_url: str


class BackendHTTPClient:
    """HTTP client for communicating with Go backend."""

    def __init__(self, base_url: str, timeout: float = 10.0):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def get_active_cameras(self) -> list[CameraInfo]:
        """Get list of active cameras from Go backend."""
        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.get(f"{self.base_url}/api/v1/cameras?isActive=true")
                response.raise_for_status()

                cameras_data = response.json()
                cameras = []
                for cam in cameras_data:
                    cameras.append(
                        CameraInfo(
                            guid=cam["guid"],
                            name=cam["name"],
                            rtsp_url=cam["rtspUrl"],
                        )
                    )
                logger.info(f"Retrieved {len(cameras)} active cameras from backend")
                return cameras

        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error getting active cameras: {e}")
            return []
        except httpx.RequestError as e:
            logger.error(f"Request error getting active cameras: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error getting active cameras: {e}")
            return []

from dataclasses import dataclass
from datetime import datetime
from enum import Enum


class WorkerStatus(str, Enum):
    RUNNING = "running"
    STOPPED = "stopped"
    ERROR = "error"


@dataclass
class Worker:
    camera_id: str
    rtsp_url: str
    status: WorkerStatus = WorkerStatus.STOPPED
    started_at: datetime | None = None
    error: str = ""

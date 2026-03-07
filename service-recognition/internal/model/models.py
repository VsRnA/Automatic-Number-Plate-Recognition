from dataclasses import dataclass


@dataclass
class BoundingBox:
    x: int
    y: int
    width: int
    height: int


@dataclass
class PlateResult:
    plate_number: str
    confidence: float
    bounding_box: BoundingBox


@dataclass
class RawDetection:
    bounding_box: BoundingBox
    confidence: float


@dataclass
class RecognitionResult:
    plates: list[PlateResult]
    raw_detections: list[RawDetection]
    processing_time_ms: str


@dataclass
class VideoFrameResult:
    frame_number: int
    plates: list[PlateResult]
    screenshot_url: str | None

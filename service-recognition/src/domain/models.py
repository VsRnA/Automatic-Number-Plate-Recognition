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
class RecognitionResult:
    success: bool
    plates: list[PlateResult]
    processing_time_ms: str
    error: str = ""

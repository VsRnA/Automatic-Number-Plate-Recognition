from dataclasses import dataclass, field


@dataclass
class ZonePoint:
    x: float
    y: float


@dataclass
class WorkerZoneConfig:
    points: list[ZonePoint]
    min_plate_rel: float = 0.0
    max_plate_rel: float = 1.0
    max_tilt: int = 45

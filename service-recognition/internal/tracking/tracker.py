from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field

import numpy as np

from internal.model.detections import FrameDetection, VehicleDetection
from internal.model.models import BoundingBox
from internal.ml.preprocessing.bbox_utils import iou

logger = logging.getLogger(__name__)


def _levenshtein(s1: str, s2: str) -> int:
    if len(s1) < len(s2):
        s1, s2 = s2, s1
    if not s2:
        return len(s1)
    prev = list(range(len(s2) + 1))
    for c1 in s1:
        curr = [prev[0] + 1]
        for j, c2 in enumerate(s2):
            curr.append(min(prev[j + 1] + 1, curr[j] + 1, prev[j] + (c1 != c2)))
        prev = curr
    return prev[-1]


def select_best_reading(
    readings: list[tuple[str, float]],
    fuzzy_distance: int,
) -> tuple[str, float] | None:
    """
    Group readings by fuzzy similarity (Levenshtein <= fuzzy_distance).
    Pick the largest group; within it, return the reading with highest confidence.
    """
    if not readings:
        return None

    groups: list[list[tuple[str, float]]] = []
    group_keys: list[str] = []

    for text, conf in readings:
        matched = False
        for i, key in enumerate(group_keys):
            if _levenshtein(text, key) <= fuzzy_distance:
                groups[i].append((text, conf))
                matched = True
                break
        if not matched:
            group_keys.append(text)
            groups.append([(text, conf)])

    largest = max(groups, key=len)
    best_text, best_conf = max(largest, key=lambda r: r[1])
    return best_text, best_conf


@dataclass
class Track:
    id: str
    last_vehicle_bbox: BoundingBox | None
    last_plate_bbox: BoundingBox
    readings: list[tuple[str, float]] = field(default_factory=list)
    best_frame: np.ndarray | None = field(default=None, repr=False)
    best_vehicle_bbox: BoundingBox | None = None
    best_plate_bbox: BoundingBox | None = None
    frames_since_seen: int = 0


@dataclass
class ConfirmedDetection:
    plate_text: str
    confidence: float
    best_frame: np.ndarray | None
    vehicle_bbox: BoundingBox | None
    plate_bbox: BoundingBox


class Tracker:
    def __init__(
        self,
        stale_frames: int = 15,
        fuzzy_distance: int = 1,
        min_iou: float = 0.3,
        min_readings: int = 2,
    ):
        self._stale_frames = stale_frames
        self._fuzzy_distance = fuzzy_distance
        self._min_iou = min_iou
        self._min_readings = min_readings
        self._tracks: list[Track] = []

    def update(self, detections: list[FrameDetection]) -> list[ConfirmedDetection]:
        """
        Update tracker with new frame detections.
        Returns list of ConfirmedDetections for tracks that went stale this frame.
        """
        # Age all tracks
        for track in self._tracks:
            track.frames_since_seen += 1

        # Match each detection to an existing track
        matched_track_ids: set[str] = set()
        for det in detections:
            track = self._find_matching_track(det, matched_track_ids)
            if track is not None:
                self._update_track(track, det)
                matched_track_ids.add(track.id)
            else:
                new_track = Track(
                    id=str(uuid.uuid4()),
                    last_vehicle_bbox=det.vehicle.bbox if det.vehicle else None,
                    last_plate_bbox=det.plate.bbox,
                    best_frame=det.frame,
                    best_vehicle_bbox=det.vehicle.bbox if det.vehicle else None,
                    best_plate_bbox=det.plate.bbox,
                )
                new_track.readings.append((det.plate_text, det.ocr_confidence))
                self._tracks.append(new_track)

        # Publish and remove stale tracks
        confirmed: list[ConfirmedDetection] = []
        still_alive: list[Track] = []
        for track in self._tracks:
            if track.frames_since_seen > self._stale_frames:
                result = self._try_confirm(track)
                if result is not None:
                    confirmed.append(result)
                    logger.info(
                        f"Tracker: confirmed stale track '{result.plate_text}' "
                        f"({len(track.readings)} readings)"
                    )
            else:
                still_alive.append(track)
        self._tracks = still_alive

        return confirmed

    def flush(self) -> list[ConfirmedDetection]:
        """Drain all remaining tracks. Call on shutdown."""
        confirmed: list[ConfirmedDetection] = []
        for track in self._tracks:
            result = self._try_confirm(track)
            if result is not None:
                confirmed.append(result)
                logger.info(
                    f"Tracker: flushing track '{result.plate_text}' "
                    f"({len(track.readings)} readings)"
                )
        self._tracks = []
        return confirmed

    def _find_matching_track(
        self,
        det: FrameDetection,
        already_matched: set[str],
    ) -> Track | None:
        best_track: Track | None = None
        best_score: float = -1.0

        for track in self._tracks:
            if track.id in already_matched:
                continue

            score = self._match_score(det, track)
            if score > best_score:
                best_score = score
                best_track = track

        return best_track if best_score > 0 else None

    def _match_score(self, det: FrameDetection, track: Track) -> float:
        """
        Returns positive score if any matching criterion is met, else 0.
        Priority: vehicle IoU > plate IoU > text fuzzy.
        """
        # 1. Vehicle bbox IoU
        if det.vehicle is not None and track.last_vehicle_bbox is not None:
            vehicle_iou = iou(det.vehicle.bbox, track.last_vehicle_bbox)
            if vehicle_iou >= self._min_iou:
                return 3.0 + vehicle_iou

        # 2. Plate bbox IoU
        plate_iou = iou(det.plate.bbox, track.last_plate_bbox)
        if plate_iou >= self._min_iou:
            return 2.0 + plate_iou

        # 3. Text fuzzy match
        if track.readings:
            best = select_best_reading(track.readings, self._fuzzy_distance)
            if best is not None:
                best_text, _ = best
                if _levenshtein(det.plate_text, best_text) <= self._fuzzy_distance:
                    return 1.0

        return 0.0

    def _update_track(self, track: Track, det: FrameDetection) -> None:
        track.frames_since_seen = 0
        track.last_plate_bbox = det.plate.bbox
        if det.vehicle is not None:
            track.last_vehicle_bbox = det.vehicle.bbox

        prev_best_conf = max((r[1] for r in track.readings), default=-1.0)
        track.readings.append((det.plate_text, det.ocr_confidence))

        # Keep best frame (highest ocr confidence)
        if det.ocr_confidence >= prev_best_conf:
            track.best_frame = det.frame
            track.best_plate_bbox = det.plate.bbox
            if det.vehicle is not None:
                track.best_vehicle_bbox = det.vehicle.bbox

    def _try_confirm(self, track: Track) -> ConfirmedDetection | None:
        if len(track.readings) < self._min_readings:
            return None
        result = select_best_reading(track.readings, self._fuzzy_distance)
        if result is None:
            return None
        text, conf = result
        return ConfirmedDetection(
            plate_text=text,
            confidence=conf,
            best_frame=track.best_frame,
            vehicle_bbox=track.best_vehicle_bbox,
            plate_bbox=track.best_plate_bbox or track.last_plate_bbox,
        )

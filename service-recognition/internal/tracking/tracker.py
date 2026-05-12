from __future__ import annotations

import logging
import time
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

    vote_counts: dict[str, int] = {}
    vote_best_conf: dict[str, float] = {}
    for text, conf in largest:
        vote_counts[text] = vote_counts.get(text, 0) + 1
        if conf > vote_best_conf.get(text, -1.0):
            vote_best_conf[text] = conf

    best_text = max(vote_counts, key=lambda t: (vote_counts[t], vote_best_conf[t]))
    return best_text, vote_best_conf[best_text]


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
    published: bool = False


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
        cooldown_seconds: float = 30.0,
        text_match_enabled: bool = False,
    ):
        self._stale_frames = stale_frames
        self._fuzzy_distance = fuzzy_distance
        self._min_iou = min_iou
        self._min_readings = min_readings
        self._cooldown_seconds = cooldown_seconds
        self._text_match_enabled = text_match_enabled
        self._tracks: list[Track] = []
        self._last_published: dict[str, float] = {}

    def update(self, detections: list[FrameDetection]) -> list[ConfirmedDetection]:
        now = time.monotonic()
        cutoff = now - self._cooldown_seconds * 2
        self._last_published = {k: v for k, v in self._last_published.items() if v > cutoff}
        if len(self._last_published) > 10_000:
            self._last_published.clear()

        for track in self._tracks:
            track.frames_since_seen += 1

        confirmed: list[ConfirmedDetection] = []
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
                track = new_track
                logger.debug(
                    "Tracker: new track started",
                    extra={
                        "event": "track_started",
                        "track_id": new_track.id,
                        "plate_text": det.plate_text,
                        "confidence": round(det.ocr_confidence, 4),
                        "has_vehicle": det.vehicle is not None,
                    },
                )

            if not track.published:
                result = self._try_confirm_early(track)
                if result is not None:
                    track.published = True
                    confirmed.append(result)
                    logger.info(
                        "Tracker: plate confirmed (early)",
                        extra={
                            "event": "plate_confirmed",
                            "plate_text": result.plate_text,
                            "readings_count": len(track.readings),
                            "confidence": round(result.confidence, 4),
                        },
                    )

        still_alive: list[Track] = []
        for track in self._tracks:
            if track.published:
                continue
            if track.frames_since_seen > self._stale_frames:
                result = self._try_confirm(track)
                if result is not None:
                    confirmed.append(result)
                    logger.info(
                        "Tracker: plate confirmed (stale)",
                        extra={
                            "event": "plate_confirmed",
                            "plate_text": result.plate_text,
                            "readings_count": len(track.readings),
                            "confidence": round(result.confidence, 4),
                        },
                    )
                elif len(track.readings) < self._min_readings:
                    logger.debug(
                        "Stale track discarded: not enough readings",
                        extra={
                            "event": "tracker_track_discarded",
                            "readings_count": len(track.readings),
                            "min_readings": self._min_readings,
                            "frames_since_seen": track.frames_since_seen,
                        },
                    )
            else:
                still_alive.append(track)
        self._tracks = still_alive

        return confirmed

    def flush(self) -> list[ConfirmedDetection]:
        confirmed: list[ConfirmedDetection] = []
        for track in self._tracks:
            if track.published:
                continue
            result = self._try_confirm(track)
            if result is not None:
                confirmed.append(result)
                logger.info(
                    "Tracker: plate confirmed (flush)",
                    extra={
                        "event": "plate_confirmed",
                        "plate_text": result.plate_text,
                        "readings_count": len(track.readings),
                        "confidence": round(result.confidence, 4),
                    },
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
        if det.vehicle is not None and track.last_vehicle_bbox is not None:
            vehicle_iou = iou(det.vehicle.bbox, track.last_vehicle_bbox)
            if vehicle_iou >= self._min_iou:
                return 3.0 + vehicle_iou

        plate_iou = iou(det.plate.bbox, track.last_plate_bbox)
        if plate_iou >= self._min_iou:
            return 2.0 + plate_iou

        if self._text_match_enabled and track.readings:
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

        if det.ocr_confidence >= prev_best_conf:
            track.best_frame = det.frame
            track.best_plate_bbox = det.plate.bbox
            if det.vehicle is not None:
                track.best_vehicle_bbox = det.vehicle.bbox

    def _try_confirm_early(self, track: Track) -> ConfirmedDetection | None:
        if len(track.readings) < self._min_readings:
            return None
        result = select_best_reading(track.readings, self._fuzzy_distance)
        if result is None:
            return None
        best_text, best_conf = result
        group_size = sum(
            1 for t, _ in track.readings
            if _levenshtein(t, best_text) <= self._fuzzy_distance
        )
        if group_size < self._min_readings:
            return None
        return self._build_confirmed(track, best_text, best_conf)

    def _try_confirm(self, track: Track) -> ConfirmedDetection | None:
        if len(track.readings) < self._min_readings:
            return None
        result = select_best_reading(track.readings, self._fuzzy_distance)
        if result is None:
            return None
        text, conf = result
        return self._build_confirmed(track, text, conf)

    def _build_confirmed(self, track: Track, text: str, conf: float) -> ConfirmedDetection | None:
        now = time.monotonic()

        cutoff = now - self._cooldown_seconds * 2
        self._last_published = {k: v for k, v in self._last_published.items() if v > cutoff}

        last = self._last_published.get(text)
        if last is not None and now - last < self._cooldown_seconds:
            logger.info(
                "Tracker: plate suppressed by cooldown",
                extra={
                    "event": "tracker_cooldown_skip",
                    "plate_text": text,
                    "elapsed_s": round(now - last, 1),
                    "cooldown_s": self._cooldown_seconds,
                },
            )
            return None
        self._last_published[text] = now
        return ConfirmedDetection(
            plate_text=text,
            confidence=conf,
            best_frame=track.best_frame,
            vehicle_bbox=track.best_vehicle_bbox,
            plate_bbox=track.best_plate_bbox or track.last_plate_bbox,
        )

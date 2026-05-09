package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"

	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/model"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/repository"
)

const dedupWindow = 60 * time.Second

type redisPayload struct {
	RequestID string         `json:"request_id"`
	CameraID  string         `json:"camera_id"`
	Timestamp string         `json:"timestamp"`
	Plates    []platePayload `json:"plates"`
}

type platePayload struct {
	PlateNumber   string  `json:"plate_number"`
	Confidence    float64 `json:"confidence"`
	ScreenshotURL string  `json:"screenshot_url"`
}

type RecognitionWorker struct {
	plateRepo   repository.IPlateRepository
	papRepo     repository.IPlateAccessPointRepository
	cameraRepo  repository.ICameraRepository
	historyRepo repository.IRecognitionHistoryRepository
}

func NewRecognitionWorker(
	plateRepo repository.IPlateRepository,
	papRepo repository.IPlateAccessPointRepository,
	cameraRepo repository.ICameraRepository,
	historyRepo repository.IRecognitionHistoryRepository,
) *RecognitionWorker {
	return &RecognitionWorker{
		plateRepo:   plateRepo,
		papRepo:     papRepo,
		cameraRepo:  cameraRepo,
		historyRepo: historyRepo,
	}
}

func (w *RecognitionWorker) Handle(ctx context.Context, data []byte) error {
	var payload redisPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		return fmt.Errorf("unmarshal payload: %w", err)
	}

	cameraGuid, err := uuid.Parse(payload.CameraID)
	if err != nil {
		return fmt.Errorf("invalid camera_id %q: %w", payload.CameraID, err)
	}

	occurredAt, err := time.Parse(time.RFC3339, payload.Timestamp)
	if err != nil {
		occurredAt = time.Now().UTC()
	}

	var accessPointId *int
	camera, err := w.cameraRepo.Find(cameraGuid)
	if err != nil {
		slog.Error("Camera lookup error", "camera_id", cameraGuid, "error", err)
	} else if camera != nil {
		accessPointId = camera.AccessPointId
	}

	since := occurredAt.Add(-dedupWindow)
	recentRecords, err := w.historyRepo.List(&repository.RecognitionHistoryFilters{
		CameraGuid: &cameraGuid,
		DateFrom:   &since,
		DateTo:     &occurredAt,
		Limit:      100,
	})
	if err != nil {
		return fmt.Errorf("RecognitionWorker: failed to load recent records for dedup: %w", err)
	}

	for _, plate := range payload.Plates {
		if plate.PlateNumber == "" {
			continue
		}

		duplicate := findDuplicate(recentRecords, plate.PlateNumber)

		if duplicate != nil {
			if plate.Confidence <= duplicate.Confidence {
				slog.Info("Plate dedup: skipped (lower confidence)",
					"camera_id", cameraGuid,
					"plate", plate.PlateNumber,
					"existing_conf", duplicate.Confidence,
					"new_conf", plate.Confidence,
				)
				continue
			}
			matchedForUpdate, _ := w.plateRepo.Get(&repository.PlateFilters{Number: &plate.PlateNumber})
			duplicate.PlateNumber = plate.PlateNumber
			duplicate.Confidence = plate.Confidence
			duplicate.SnapshotUrl = plate.ScreenshotURL
			duplicate.AccessGranted = resolveAccessGranted(w.papRepo, matchedForUpdate, accessPointId, occurredAt)
			if err := w.historyRepo.Update(duplicate); err != nil {
				slog.Error("Failed to update history for plate", "camera_id", cameraGuid, "plate", plate.PlateNumber, "error", err)
			} else {
				slog.Info("Plate dedup: updated (higher confidence)",
					"camera_id", cameraGuid,
					"plate", plate.PlateNumber,
					"new_conf", plate.Confidence,
				)
			}
			continue
		}

		var plateGuid *uuid.UUID
		matched, err := w.plateRepo.Get(&repository.PlateFilters{Number: &plate.PlateNumber})
		if err != nil {
			slog.Error("Plate lookup error", "camera_id", cameraGuid, "plate", plate.PlateNumber, "error", err)
		} else if matched != nil {
			g := matched.Guid
			plateGuid = &g
		}

		accessGranted := resolveAccessGranted(w.papRepo, matched, accessPointId, occurredAt)

		record := &model.RecognitionHistory{
			CameraGuid:    cameraGuid,
			AccessPointId: accessPointId,
			PlateNumber:   plate.PlateNumber,
			PlateGuid:     plateGuid,
			Confidence:    plate.Confidence,
			AccessGranted: accessGranted,
			SnapshotUrl:   plate.ScreenshotURL,
			OccurredAt:    occurredAt,
		}

		if err := w.historyRepo.Create(record); err != nil {
			slog.Error("Failed to save history for plate", "camera_id", cameraGuid, "plate", plate.PlateNumber, "error", err)
			continue
		}

		slog.Info("Plate saved",
			"camera_id", cameraGuid,
			"plate", plate.PlateNumber,
			"known", plateGuid != nil,
			"access_granted", accessGranted != nil && *accessGranted,
		)
	}

	return nil
}

func resolveAccessGranted(papRepo repository.IPlateAccessPointRepository, plate *model.Plate, accessPointId *int, at time.Time) *bool {
	granted := false
	if plate != nil && plate.IsEnabled {
		if plate.ValidUntil == nil || at.Before(*plate.ValidUntil) {
			if plate.AccessType == "allowed" || plate.AccessType == "vip" {
				granted = hasAccessToPoint(papRepo, plate.Guid, accessPointId)
			}
		}
	}
	return &granted
}

func hasAccessToPoint(papRepo repository.IPlateAccessPointRepository, plateGuid uuid.UUID, accessPointId *int) bool {
	items, err := papRepo.List(&repository.PlateAccessPointFilters{PlateGuid: &plateGuid})
	if err != nil || len(items) == 0 {
		return true
	}
	if accessPointId == nil {
		return false
	}
	for _, item := range items {
		if item.AccessPointId == *accessPointId {
			return true
		}
	}
	return false
}

func findDuplicate(records []model.RecognitionHistory, plateNumber string) *model.RecognitionHistory {
	for i := range records {
		if levenshtein(plateNumber, records[i].PlateNumber) <= 1 {
			return &records[i]
		}
	}
	return nil
}

func levenshtein(s, t string) int {
	rs, rt := []rune(s), []rune(t)
	if len(rs) < len(rt) {
		rs, rt = rt, rs
	}
	if len(rt) == 0 {
		return len(rs)
	}
	prev := make([]int, len(rt)+1)
	for i := range prev {
		prev[i] = i
	}
	for _, cs := range rs {
		curr := make([]int, len(rt)+1)
		curr[0] = prev[0] + 1
		for j, ct := range rt {
			cost := 1
			if cs == ct {
				cost = 0
			}
			curr[j+1] = min(prev[j+1]+1, min(curr[j]+1, prev[j]+cost))
		}
		prev = curr
	}
	return prev[len(rt)]
}

package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
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
	cameraRepo  repository.ICameraRepository
	historyRepo repository.IRecognitionHistoryRepository
}

func NewRecognitionWorker(
	plateRepo repository.IPlateRepository,
	cameraRepo repository.ICameraRepository,
	historyRepo repository.IRecognitionHistoryRepository,
) *RecognitionWorker {
	return &RecognitionWorker{
		plateRepo:   plateRepo,
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
		log.Printf("RecognitionWorker: camera lookup error %s: %v", cameraGuid, err)
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
		log.Printf("RecognitionWorker: failed to load recent records for dedup: %v", err)
		recentRecords = nil
	}

	for _, plate := range payload.Plates {
		if plate.PlateNumber == "" {
			continue
		}

		duplicate := findDuplicate(recentRecords, plate.PlateNumber)

		if duplicate != nil {
			if plate.Confidence <= duplicate.Confidence {
				log.Printf("RecognitionWorker: skip duplicate plate %q (existing conf=%.2f >= new conf=%.2f)",
					plate.PlateNumber, duplicate.Confidence, plate.Confidence)
				continue
			}
			duplicate.PlateNumber = plate.PlateNumber
			duplicate.Confidence = plate.Confidence
			duplicate.SnapshotUrl = plate.ScreenshotURL
			if err := w.historyRepo.Update(duplicate); err != nil {
				log.Printf("RecognitionWorker: failed to update history for plate %q: %v", plate.PlateNumber, err)
			} else {
				log.Printf("RecognitionWorker: updated — camera=%s plate=%q conf=%.2f",
					cameraGuid, plate.PlateNumber, plate.Confidence)
			}
			continue
		}

		var plateGuid *uuid.UUID
		matched, err := w.plateRepo.Get(&repository.PlateFilters{Number: &plate.PlateNumber})
		if err != nil {
			log.Printf("RecognitionWorker: plate lookup error %q: %v", plate.PlateNumber, err)
		} else if matched != nil {
			g := matched.Guid
			plateGuid = &g
		}

		record := &model.RecognitionHistory{
			CameraGuid:    cameraGuid,
			AccessPointId: accessPointId,
			PlateNumber:   plate.PlateNumber,
			PlateGuid:     plateGuid,
			Confidence:    plate.Confidence,
			SnapshotUrl:   plate.ScreenshotURL,
			OccurredAt:    occurredAt,
		}

		if err := w.historyRepo.Create(record); err != nil {
			log.Printf("RecognitionWorker: failed to save history for plate %q: %v", plate.PlateNumber, err)
			continue
		}

		log.Printf("RecognitionWorker: saved — camera=%s plate=%q known=%v",
			cameraGuid, plate.PlateNumber, plateGuid != nil)
	}

	return nil
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

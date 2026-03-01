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

	// Получаем accessPointId из камеры.
	var accessPointId *int
	camera, err := w.cameraRepo.Find(cameraGuid)
	if err != nil {
		log.Printf("RecognitionWorker: camera lookup error %s: %v", cameraGuid, err)
	} else if camera != nil {
		accessPointId = camera.AccessPointId
	}

	for _, plate := range payload.Plates {
		if plate.PlateNumber == "" {
			continue
		}

		// Ищем номер в базе данных.
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

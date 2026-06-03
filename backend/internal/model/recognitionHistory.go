package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type RecognitionHistory struct {
	ID            uuid.UUID  `json:"id" gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()"`
	CameraGuid    uuid.UUID  `json:"cameraGuid" gorm:"column:cameraGuid;type:uuid;not null;index"`
	AccessPointId *int       `json:"accessPointId" gorm:"column:accessPointId"`
	PlateNumber   string     `json:"plateNumber" gorm:"column:plateNumber;size:20;not null;index"`
	PlateGuid     *uuid.UUID `json:"plateGuid" gorm:"column:plateGuid;type:uuid"`
	Confidence    float64    `json:"confidence" gorm:"column:confidence"`
	AccessGranted *bool          `json:"accessGranted" gorm:"column:accessGranted"`
	ScudResult    datatypes.JSON `json:"scudResult" gorm:"column:scudResult;type:jsonb"`
	SnapshotUrl   string         `json:"snapshotUrl" gorm:"column:snapshotUrl;size:500"`
	OccurredAt    time.Time  `json:"occurredAt" gorm:"column:occurredAt;not null;index"`
	CreatedAt     time.Time  `json:"createdAt" gorm:"column:createdAt"`
}

func (RecognitionHistory) TableName() string {
	return "recognitionHistory"
}

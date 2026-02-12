package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type Camera struct {
	Guid          uuid.UUID      `json:"guid" gorm:"column:guid;type:uuid;primaryKey;default:gen_random_uuid()"`
	Name          string         `json:"name" gorm:"column:name;size:100;not null"`
	Stream        string         `json:"stream" gorm:"column:stream;size:500;not null"`
	StreamHd      string         `json:"streamHd" gorm:"column:streamHd;size:500;not null"`
	Login         *string        `json:"login" gorm:"column:login;size:100"`
	Password      *string        `json:"password" gorm:"column:password;size:255"`
	AccessPointId *int           `json:"accessPointId" gorm:"column:accessPointId"`
	IsEnabled     bool           `json:"isEnabled" gorm:"column:isEnabled;default:false"`
	Metadata      datatypes.JSON `json:"metadata" gorm:"column:metadata;type:jsonb"`
	CreatedAt     time.Time      `json:"createdAt" gorm:"column:createdAt"`
	UpdatedAt     time.Time      `json:"updatedAt" gorm:"column:updatedAt"`
	DeletedAt     gorm.DeletedAt `json:"deletedAt" gorm:"column:deletedAt;index"`
}

func (Camera) TableName() string {
	return "cameras"
}

type CreateCameraRequest struct {
	Name          string         `json:"name" validate:"required,min=1,max=100"`
	Stream        string         `json:"stream" validate:"required,url,max=500"`
	StreamHd      string         `json:"streamHd" validate:"required,url,max=500"`
	Login         *string        `json:"login" validate:"omitempty,max=100"`
	Password      *string        `json:"password" validate:"omitempty,max=255"`
	AccessPointId *int           `json:"accessPointId" validate:"omitempty,min=1"`
	IsEnabled     *bool          `json:"isEnabled"`
	Metadata      map[string]any `json:"metadata"`
}

type UpdateCameraRequest struct {
	Name          string         `json:"name" validate:"omitempty,min=1,max=100"`
	Stream        string         `json:"stream" validate:"omitempty,url,max=500"`
	StreamHd      string         `json:"streamHd" validate:"omitempty,url,max=500"`
	Login         *string        `json:"login" validate:"omitempty,max=100"`
	Password      *string        `json:"password" validate:"omitempty,max=255"`
	AccessPointId *int           `json:"accessPointId" validate:"omitempty,min=1"`
	IsEnabled     *bool          `json:"isEnabled"`
	Metadata      map[string]any `json:"metadata"`
}

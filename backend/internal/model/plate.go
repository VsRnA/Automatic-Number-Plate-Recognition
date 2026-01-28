package model

import (
	"time"

	"github.com/google/uuid"
)

type Plate struct {
	Guid       uuid.UUID      `json:"guid" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	Number     string         `json:"number" gorm:"size:20;not null;index"`
	Region     string         `json:"region" gorm:"size:10"`
	AccessType string         `json:"access_type" gorm:"size:50;not null"`
	ValidUntil *time.Time     `json:"valid_until"`
	Comment    string         `json:"comment" gorm:"size:255"`
	IsActive   bool           `json:"is_active" gorm:"default:true"`
	CreatedAt  time.Time      `json:"created_at"`
}

func (Plate) TableName() string {
	return "plates"
}

type CreatePlateRequest struct {
	Number     string     `json:"number" validate:"required,min=1,max=20"`
	Region     string     `json:"region" validate:"max=10"`
	AccessType string     `json:"access_type" validate:"required,max=50"`
	ValidUntil *time.Time `json:"valid_until"`
	Comment    string     `json:"comment" validate:"max=255"`
	IsActive   *bool      `json:"is_active"`
}

type UpdatePlateRequest struct {
	Number     string     `json:"number" validate:"omitempty,min=1,max=20"`
	Region     string     `json:"region" validate:"max=10"`
	AccessType string     `json:"access_type" validate:"max=50"`
	ValidUntil *time.Time `json:"valid_until"`
	Comment    string     `json:"comment" validate:"max=255"`
	IsActive   *bool      `json:"is_active"`
}

type PlateResponse struct {
	Guid       uuid.UUID  `json:"guid"`
	Number     string     `json:"number"`
	Region     string     `json:"region"`
	AccessType string     `json:"access_type"`
	ValidUntil *time.Time `json:"valid_until"`
	Comment    string     `json:"comment"`
	IsActive   bool       `json:"is_active"`
	CreatedAt  time.Time  `json:"created_at"`
}

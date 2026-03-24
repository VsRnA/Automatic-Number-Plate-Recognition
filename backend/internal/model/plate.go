package model

import (
	"time"

	"github.com/google/uuid"
)

type Plate struct {
	Guid       uuid.UUID  `json:"guid" gorm:"column:guid;type:uuid;primaryKey;default:gen_random_uuid()"`
	Number     string     `json:"number" gorm:"column:number;size:20;not null;index"`
	Region     string     `json:"region" gorm:"column:region;size:10"`
	AccessType string     `json:"accessType" gorm:"column:accessType;size:50;not null"`
	ValidUntil *time.Time `json:"validUntil" gorm:"column:validUntil"`
	Comment    string     `json:"comment" gorm:"column:comment;size:255"`
	IsEnabled  bool       `json:"isEnabled" gorm:"column:isEnabled;default:true"`
	CreatedAt  time.Time  `json:"createdAt" gorm:"column:createdAt"`
}

func (Plate) TableName() string {
	return "plates"
}

type CreatePlateRequest struct {
	Number         string     `json:"number" validate:"required,min=1,max=20"`
	Region         string     `json:"region" validate:"max=10"`
	AccessType     string     `json:"accessType" validate:"required,max=50"`
	ValidUntil     *time.Time `json:"validUntil"`
	Comment        string     `json:"comment" validate:"max=255"`
	IsEnabled      *bool      `json:"isEnabled"`
	AccessPointIds []int      `json:"accessPointIds"`
}

type UpdatePlateRequest struct {
	Number         string     `json:"number" validate:"omitempty,min=1,max=20"`
	Region         string     `json:"region" validate:"max=10"`
	AccessType     string     `json:"accessType" validate:"max=50"`
	ValidUntil     *time.Time `json:"validUntil"`
	Comment        string     `json:"comment" validate:"max=255"`
	IsEnabled      *bool      `json:"isEnabled"`
	AccessPointIds *[]int     `json:"accessPointIds"`
}

type PlateResponse struct {
	Guid           uuid.UUID  `json:"guid"`
	Number         string     `json:"number"`
	Region         string     `json:"region"`
	AccessType     string     `json:"accessType"`
	ValidUntil     *time.Time `json:"validUntil"`
	Comment        string     `json:"comment"`
	IsEnabled      bool       `json:"isEnabled"`
	CreatedAt      time.Time  `json:"createdAt"`
	AccessPointIds []int      `json:"accessPointIds"`
}

type ImportRowErrors struct {
	Number     string `json:"number,omitempty"`
	Region     string `json:"region,omitempty"`
	AccessType string `json:"accessType,omitempty"`
	ValidUntil string `json:"validUntil,omitempty"`
}

type ImportPreviewRow struct {
	Row        int             `json:"row"`
	Number     string          `json:"number"`
	Region     string          `json:"region"`
	AccessType string          `json:"accessType"`
	ValidUntil *time.Time      `json:"validUntil"`
	Comment    string          `json:"comment"`
	IsEnabled  bool            `json:"isEnabled"`
	Errors     ImportRowErrors `json:"errors"`
	Status     string          `json:"status"`
}

type ImportPreviewResponse struct {
	Rows           []ImportPreviewRow `json:"rows"`
	TotalOk        int                `json:"totalOk"`
	TotalDuplicates int               `json:"totalDuplicates"`
	TotalInvalid   int                `json:"totalInvalid"`
}

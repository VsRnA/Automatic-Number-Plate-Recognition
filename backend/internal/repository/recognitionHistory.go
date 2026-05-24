package repository

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/model"
)

type RecognitionHistoryFilters struct {
	CameraGuid    *uuid.UUID
	AccessPointId *int
	PlateNumber   *string
	AccessGranted *bool
	UnknownOnly   *bool
	DateFrom      *time.Time
	DateTo        *time.Time
	Limit         int
	Offset        int
}

type IRecognitionHistoryRepository interface {
	Create(h *model.RecognitionHistory) error
	Update(h *model.RecognitionHistory) error
	List(filters *RecognitionHistoryFilters) ([]model.RecognitionHistory, error)
	Count(filters *RecognitionHistoryFilters) (int64, error)
}

type RecognitionHistoryRepository struct {
	db *gorm.DB
}

func NewRecognitionHistoryRepository(db *gorm.DB) IRecognitionHistoryRepository {
	return &RecognitionHistoryRepository{db: db}
}

func (r *RecognitionHistoryRepository) Create(h *model.RecognitionHistory) error {
	return r.db.Create(h).Error
}

func (r *RecognitionHistoryRepository) Update(h *model.RecognitionHistory) error {
	return r.db.Save(h).Error
}

func (r *RecognitionHistoryRepository) applyFilters(query *gorm.DB, filters *RecognitionHistoryFilters) *gorm.DB {
	if filters == nil {
		return query
	}
	if filters.CameraGuid != nil {
		query = query.Where("\"cameraGuid\" = ?", *filters.CameraGuid)
	}
	if filters.AccessPointId != nil {
		query = query.Where("\"accessPointId\" = ?", *filters.AccessPointId)
	}
	if filters.PlateNumber != nil && *filters.PlateNumber != "" {
		query = query.Where("\"plateNumber\" ILIKE ?", "%"+*filters.PlateNumber+"%")
	}
	if filters.AccessGranted != nil {
		query = query.Where("\"accessGranted\" = ?", *filters.AccessGranted)
	}
	if filters.UnknownOnly != nil && *filters.UnknownOnly {
		query = query.Where("\"plateGuid\" IS NULL")
	}
	if filters.DateFrom != nil {
		query = query.Where("\"occurredAt\" >= ?", *filters.DateFrom)
	}
	if filters.DateTo != nil {
		query = query.Where("\"occurredAt\" <= ?", *filters.DateTo)
	}
	return query
}

func (r *RecognitionHistoryRepository) List(filters *RecognitionHistoryFilters) ([]model.RecognitionHistory, error) {
	query := r.applyFilters(r.db.Model(&model.RecognitionHistory{}).Order("\"occurredAt\" DESC"), filters)

	if filters != nil {
		if filters.Limit > 0 {
			query = query.Limit(filters.Limit)
		}
		if filters.Offset > 0 {
			query = query.Offset(filters.Offset)
		}
	}

	var records []model.RecognitionHistory
	if err := query.Find(&records).Error; err != nil {
		return nil, err
	}
	return records, nil
}

func (r *RecognitionHistoryRepository) Count(filters *RecognitionHistoryFilters) (int64, error) {
	query := r.applyFilters(r.db.Model(&model.RecognitionHistory{}), filters)
	var count int64
	return count, query.Count(&count).Error
}

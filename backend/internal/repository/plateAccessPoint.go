package repository

import (
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/model"
)

type PlateAccessPointFilters struct {
	PlateGuid     *uuid.UUID
	AccessPointId *int
}

type IPlateAccessPointRepository interface {
	Create(pap *model.PlateAccessPoint) error
	Delete(plateGuid uuid.UUID, accessPointId int) error
	DeleteByPlate(plateGuid uuid.UUID) error
	List(filters *PlateAccessPointFilters) ([]model.PlateAccessPoint, error)
}

type PlateAccessPointRepository struct {
	db *gorm.DB
}

func NewPlateAccessPointRepository(db *gorm.DB) IPlateAccessPointRepository {
	return &PlateAccessPointRepository{db: db}
}

func (r *PlateAccessPointRepository) Create(pap *model.PlateAccessPoint) error {
	return r.db.Create(pap).Error
}

func (r *PlateAccessPointRepository) Delete(plateGuid uuid.UUID, accessPointId int) error {
	return r.db.Where("plate_guid = ? AND access_point_id = ?", plateGuid, accessPointId).
		Delete(&model.PlateAccessPoint{}).Error
}

func (r *PlateAccessPointRepository) DeleteByPlate(plateGuid uuid.UUID) error {
	return r.db.Where("plate_guid = ?", plateGuid).Delete(&model.PlateAccessPoint{}).Error
}

func (r *PlateAccessPointRepository) List(filters *PlateAccessPointFilters) ([]model.PlateAccessPoint, error) {
	query := r.db.Model(&model.PlateAccessPoint{})

	if filters != nil {
		if filters.PlateGuid != nil {
			query = query.Where("plate_guid = ?", *filters.PlateGuid)
		}
		if filters.AccessPointId != nil {
			query = query.Where("access_point_id = ?", *filters.AccessPointId)
		}
	}

	var items []model.PlateAccessPoint
	if err := query.Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

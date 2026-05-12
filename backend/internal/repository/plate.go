package repository

import (
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/model"
)

type PlateFilters struct {
	Number    *string
	IsEnabled *bool
	Limit     int
	Offset    int
}

type IPlateRepository interface {
	Create(plate *model.Plate) error
	Find(id uuid.UUID) (*model.Plate, error)
	Get(filters *PlateFilters) (*model.Plate, error)
	Update(plate *model.Plate) error
	Delete(id uuid.UUID) error
	List(filters *PlateFilters) ([]model.Plate, error)
}

type PlateRepository struct {
	db *gorm.DB
}

func NewPlateRepository(db *gorm.DB) IPlateRepository {
	return &PlateRepository{db: db}
}

func (r *PlateRepository) Create(plate *model.Plate) error {
	return r.db.Create(plate).Error
}

func (r *PlateRepository) Find(id uuid.UUID) (*model.Plate, error) {
	var plate model.Plate
	err := r.db.Where("guid = ?", id).First(&plate).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &plate, nil
}

func (r *PlateRepository) Get(filters *PlateFilters) (*model.Plate, error) {
	query := r.db.Model(&model.Plate{})

	if filters != nil {
		if filters.Number != nil && *filters.Number != "" {
			query = query.Where("number ILIKE ?", *filters.Number)
		}

		if filters.IsEnabled != nil {
			query = query.Where("\"isEnabled\" = ?", *filters.IsEnabled)
		}
	}

	var plate model.Plate
	err := query.First(&plate).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &plate, nil
}

func (r *PlateRepository) Update(plate *model.Plate) error {
	return r.db.Save(plate).Error
}

func (r *PlateRepository) Delete(id uuid.UUID) error {
	return r.db.Where("guid = ?", id).Delete(&model.Plate{}).Error
}

func (r *PlateRepository) List(filters *PlateFilters) ([]model.Plate, error) {
	query := r.db.Model(&model.Plate{})

	if filters != nil {
		if filters.Number != nil && *filters.Number != "" {
			query = query.Where("number ILIKE ?", "%"+*filters.Number+"%")
		}

		if filters.IsEnabled != nil {
			query = query.Where("\"isEnabled\" = ?", *filters.IsEnabled)
		}

		if filters.Limit > 0 {
			query = query.Limit(filters.Limit)
		}
		if filters.Offset > 0 {
			query = query.Offset(filters.Offset)
		}
	}

	var plates []model.Plate
	if err := query.Find(&plates).Error; err != nil {
		return nil, err
	}

	return plates, nil
}

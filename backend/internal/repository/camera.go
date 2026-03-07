package repository

import (
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/model"
)

type CameraFilters struct {
	Name          *string
	IsEnabled     *bool
	AccessPointId *int
	Limit         int
	Offset        int
}

type ICameraRepository interface {
	Create(camera *model.Camera) error
	Find(id uuid.UUID) (*model.Camera, error)
	Get(filters *CameraFilters) (*model.Camera, error)
	Update(camera *model.Camera) error
	Delete(id uuid.UUID) error
	List(filters *CameraFilters) ([]model.Camera, error)
}

type CameraRepository struct {
	db *gorm.DB
}

func NewCameraRepository(db *gorm.DB) ICameraRepository {
	return &CameraRepository{db: db}
}

func (r *CameraRepository) Create(camera *model.Camera) error {
	return r.db.Create(camera).Error
}

func (r *CameraRepository) Find(id uuid.UUID) (*model.Camera, error) {
	var camera model.Camera
	err := r.db.Where("guid = ?", id).First(&camera).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &camera, nil
}

func (r *CameraRepository) Get(filters *CameraFilters) (*model.Camera, error) {
	query := r.db.Model(&model.Camera{})

	if filters != nil {
		if filters.Name != nil && *filters.Name != "" {
			query = query.Where("name = ?", *filters.Name)
		}

		if filters.IsEnabled != nil {
			query = query.Where("\"isEnabled\" = ?", *filters.IsEnabled)
		}

		if filters.AccessPointId != nil {
			query = query.Where("\"accessPointId\" = ?", *filters.AccessPointId)
		}
	}

	var camera model.Camera
	err := query.First(&camera).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &camera, nil
}

func (r *CameraRepository) Update(camera *model.Camera) error {
	return r.db.Save(camera).Error
}

func (r *CameraRepository) Delete(id uuid.UUID) error {
	return r.db.Where("guid = ?", id).Delete(&model.Camera{}).Error
}

func (r *CameraRepository) List(filters *CameraFilters) ([]model.Camera, error) {
	query := r.db.Model(&model.Camera{})

	if filters != nil {
		if filters.Name != nil && *filters.Name != "" {
			query = query.Where("name ILIKE ?", "%"+*filters.Name+"%")
		}

		if filters.IsEnabled != nil {
			query = query.Where("\"isEnabled\" = ?", *filters.IsEnabled)
		}

		if filters.AccessPointId != nil {
			query = query.Where("\"accessPointId\" = ?", *filters.AccessPointId)
		}

		if filters.Limit > 0 {
			query = query.Limit(filters.Limit)
		}
		if filters.Offset > 0 {
			query = query.Offset(filters.Offset)
		}
	}

	var cameras []model.Camera
	if err := query.Find(&cameras).Error; err != nil {
		return nil, err
	}

	return cameras, nil
}

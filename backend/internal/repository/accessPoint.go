package repository

import (
	"gorm.io/gorm"

	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/model"
)

type AccessPointFilters struct {
	Name      *string
	IsEnabled *bool
	Limit     int
	Offset    int
}

type IAccessPointRepository interface {
	Create(ap *model.AccessPoint) error
	Find(id int) (*model.AccessPoint, error)
	Get(filters *AccessPointFilters) (*model.AccessPoint, error)
	Update(ap *model.AccessPoint) error
	Delete(id int) error
	List(filters *AccessPointFilters) ([]model.AccessPoint, error)
}

type AccessPointRepository struct {
	db *gorm.DB
}

func NewAccessPointRepository(db *gorm.DB) IAccessPointRepository {
	return &AccessPointRepository{db: db}
}

func (r *AccessPointRepository) Create(ap *model.AccessPoint) error {
	return r.db.Create(ap).Error
}

func (r *AccessPointRepository) Find(id int) (*model.AccessPoint, error) {
	var ap model.AccessPoint
	err := r.db.Where("id = ?", id).First(&ap).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &ap, nil
}

func (r *AccessPointRepository) Get(filters *AccessPointFilters) (*model.AccessPoint, error) {
	query := r.db.Model(&model.AccessPoint{})

	if filters != nil {
		if filters.Name != nil && *filters.Name != "" {
			query = query.Where("name = ?", *filters.Name)
		}
		if filters.IsEnabled != nil {
			query = query.Where("\"isEnabled\" = ?", *filters.IsEnabled)
		}
	}

	var ap model.AccessPoint
	err := query.First(&ap).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &ap, nil
}

func (r *AccessPointRepository) Update(ap *model.AccessPoint) error {
	return r.db.Save(ap).Error
}

func (r *AccessPointRepository) Delete(id int) error {
	return r.db.Where("id = ?", id).Delete(&model.AccessPoint{}).Error
}

func (r *AccessPointRepository) List(filters *AccessPointFilters) ([]model.AccessPoint, error) {
	query := r.db.Model(&model.AccessPoint{})

	if filters != nil {
		if filters.Name != nil && *filters.Name != "" {
			query = query.Where("name ILIKE ?", "%"+*filters.Name+"%")
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

	var aps []model.AccessPoint
	if err := query.Find(&aps).Error; err != nil {
		return nil, err
	}
	return aps, nil
}

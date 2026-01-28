package repository

import (
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/model"
)

type IPlateRepository interface {
	Create(plate *model.Plate) error
	FindByID(id uuid.UUID) (*model.Plate, error)
	Update(plate *model.Plate) error
	Delete(id uuid.UUID) error
	List(limit, offset int) ([]model.Plate, error)
	ExistsByNumber(number string) (bool, error)
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

func (r *PlateRepository) FindByID(id uuid.UUID) (*model.Plate, error) {
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

func (r *PlateRepository) Update(plate *model.Plate) error {
	return r.db.Save(plate).Error
}

func (r *PlateRepository) Delete(id uuid.UUID) error {
	return r.db.Where("guid = ?", id).Delete(&model.Plate{}).Error
}

func (r *PlateRepository) List(limit, offset int) ([]model.Plate, error) {
	var plates []model.Plate
	err := r.db.Order("created_at DESC").Limit(limit).Offset(offset).Find(&plates).Error
	if err != nil {
		return nil, err
	}
	return plates, nil
}

func (r *PlateRepository) ExistsByNumber(number string) (bool, error) {
	var count int64
	err := r.db.Model(&model.Plate{}).Where("number = ?", number).Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

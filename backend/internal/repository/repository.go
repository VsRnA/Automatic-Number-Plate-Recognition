package repository

import (
	"gorm.io/gorm"
)

type Repository struct {
	Plate  IPlateRepository
	Camera ICameraRepository
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{
		Plate:  NewPlateRepository(db),
		Camera: NewCameraRepository(db),
	}
}

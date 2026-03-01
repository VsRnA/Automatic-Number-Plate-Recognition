package repository

import (
	"gorm.io/gorm"
)

type Repository struct {
	Plate        IPlateRepository
	Camera       ICameraRepository
	AccessPoint  IAccessPointRepository
	Recognition  IRecognitionHistoryRepository
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{
		Plate:       NewPlateRepository(db),
		Camera:      NewCameraRepository(db),
		AccessPoint: NewAccessPointRepository(db),
		Recognition: NewRecognitionHistoryRepository(db),
	}
}

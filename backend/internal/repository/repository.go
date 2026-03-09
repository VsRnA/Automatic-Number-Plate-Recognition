package repository

import (
	"gorm.io/gorm"
)

type Repository struct {
	Plate        IPlateRepository
	Camera       ICameraRepository
	AccessPoint  IAccessPointRepository
	Recognition  IRecognitionHistoryRepository
	ApiToken     IApiTokenRepository
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{
		Plate:       NewPlateRepository(db),
		Camera:      NewCameraRepository(db),
		AccessPoint: NewAccessPointRepository(db),
		Recognition: NewRecognitionHistoryRepository(db),
		ApiToken:    NewApiTokenRepository(db),
	}
}

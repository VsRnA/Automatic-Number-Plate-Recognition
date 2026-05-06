package repository

import (
	"gorm.io/gorm"
)

type Repository struct {
	Plate            IPlateRepository
	Camera           ICameraRepository
	AccessPoint      IAccessPointRepository
	Recognition      IRecognitionHistoryRepository
	ApiToken         IApiTokenRepository
	PlateAccessPoint IPlateAccessPointRepository
	Analytics        IAnalyticsRepository
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{
		Plate:            NewPlateRepository(db),
		Camera:           NewCameraRepository(db),
		AccessPoint:      NewAccessPointRepository(db),
		Recognition:      NewRecognitionHistoryRepository(db),
		ApiToken:         NewApiTokenRepository(db),
		PlateAccessPoint: NewPlateAccessPointRepository(db),
		Analytics:        NewAnalyticsRepository(db),
	}
}

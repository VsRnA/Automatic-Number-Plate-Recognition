package repository

import (
	"gorm.io/gorm"
)

type Repository struct {
	Plate IPlateRepository
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{
		Plate: NewPlateRepository(db),
	}
}

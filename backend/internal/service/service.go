package service

import "github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/repository"

type Service struct {
	Plate IPlateService
}

func NewService(repo *repository.Repository) *Service {
	return &Service{
		Plate: NewPlateService(repo.Plate),
	}
}

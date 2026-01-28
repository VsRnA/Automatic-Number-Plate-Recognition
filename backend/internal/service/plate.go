package service

import (
	"fmt"

	"github.com/google/uuid"

	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/exception"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/model"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/repository"
)

type IPlateService interface {
	CreatePlate(req *model.CreatePlateRequest) (*model.Plate, *exception.ApiError)
	GetPlate(id uuid.UUID) (*model.Plate, *exception.ApiError)
	FindPlate(id uuid.UUID) (*model.Plate, *exception.ApiError)
	UpdatePlate(id uuid.UUID, req *model.UpdatePlateRequest) (*model.Plate, *exception.ApiError)
	DeletePlate(id uuid.UUID) *exception.ApiError
	ListPlates(limit, offset int) ([]model.Plate, *exception.ApiError)
}

type PlateService struct {
	repo   repository.IPlateRepository
	entity string
}

func NewPlateService(repo repository.IPlateRepository) IPlateService {
	return &PlateService{
		repo:   repo,
		entity: "plate",
	}
}

func (s *PlateService) CreatePlate(req *model.CreatePlateRequest) (*model.Plate, *exception.ApiError) {
	exists, err := s.repo.ExistsByNumber(req.Number)
	if err != nil {
		return nil, exception.InternalError("failed exists by number check: " + err.Error())
	}
	if exists {
		return nil, exception.EntityAlreadyExistsError(s.entity, fmt.Sprintf("number: %s", req.Number))
	}

	plate := &model.Plate{
		Number:     req.Number,
		Region:     req.Region,
		AccessType: req.AccessType,
		ValidUntil: req.ValidUntil,
		Comment:    req.Comment,
		IsActive:   true,
	}

	if req.IsActive != nil {
		plate.IsActive = *req.IsActive
	}

	if err := s.repo.Create(plate); err != nil {
		return nil, exception.InternalError("failed plate creating: " + err.Error())
	}

	return plate, nil
}

func (s *PlateService) FindPlate(id uuid.UUID) (*model.Plate, *exception.ApiError) {
	if id == uuid.Nil {
		return nil, exception.RequestValidationError("invalid uuid format")
	}

	plate, err := s.repo.FindByID(id)
	if err != nil {
		return nil, exception.InternalError("failed find plate: " + err.Error())
	}

	return plate, nil
}

func (s *PlateService) GetPlate(id uuid.UUID) (*model.Plate, *exception.ApiError) {
	plate, err := s.FindPlate(id)
	if err != nil {
		return nil, err
	}

	if plate == nil {
		return nil, exception.EntityNotFoundError(s.entity, fmt.Sprintf("id: %s", id))
	}

	return plate, nil
}

func (s *PlateService) UpdatePlate(id uuid.UUID, req *model.UpdatePlateRequest) (*model.Plate, *exception.ApiError) {
	plate, apiErr := s.GetPlate(id)
	if apiErr != nil {
		return nil, apiErr
	}

	if req.Number != "" {
		plate.Number = req.Number
	}
	if req.Region != "" {
		plate.Region = req.Region
	}
	if req.AccessType != "" {
		plate.AccessType = req.AccessType
	}
	if req.ValidUntil != nil {
		plate.ValidUntil = req.ValidUntil
	}
	if req.Comment != "" {
		plate.Comment = req.Comment
	}
	if req.IsActive != nil {
		plate.IsActive = *req.IsActive
	}

	if err := s.repo.Update(plate); err != nil {
		return nil, exception.InternalError("failed update plate: " + err.Error())
	}

	return plate, nil
}

func (s *PlateService) DeletePlate(id uuid.UUID) *exception.ApiError {
	_, apiErr := s.GetPlate(id)
	if apiErr != nil {
		return apiErr
	}

	if err := s.repo.Delete(id); err != nil {
		return exception.InternalError("failed plate delete: " + err.Error())
	}

	return nil
}

func (s *PlateService) ListPlates(limit, offset int) ([]model.Plate, *exception.ApiError) {
	if limit <= 0 {
		limit = 10
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	plates, err := s.repo.List(limit, offset)
	if err != nil {
		return nil, exception.InternalError("failed plate list: " + err.Error())
	}

	return plates, nil
}

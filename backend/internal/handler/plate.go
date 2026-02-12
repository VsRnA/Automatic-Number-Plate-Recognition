package handler

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"

	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/exception"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/model"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/repository"
)

type IPlateHandler interface {
	CreatePlate(c *gin.Context)
	GetPlate(c *gin.Context)
	UpdatePlate(c *gin.Context)
	DeletePlate(c *gin.Context)
	ListPlates(c *gin.Context)
}

type PlateHandler struct {
	plate    *plateDeps
	validate *validator.Validate
	entity   string
}

type plateDeps struct {
	repo repository.IPlateRepository
}

func NewPlateHandler(repo repository.IPlateRepository, validate *validator.Validate) IPlateHandler {
	return &PlateHandler{
		plate: &plateDeps{
			repo: repo,
		},
		validate: validate,
		entity:   "plate",
	}
}

func (h *PlateHandler) CreatePlate(c *gin.Context) {
	var req model.CreatePlateRequest
	if err := h.validateRequestBody(c, &req); err != nil {
		exception.HttpResponseException(c, exception.RequestValidationError(err.Error()))
		return
	}

	existing, err := h.plate.repo.Get(&repository.PlateFilters{Number: &req.Number})
	if err != nil {
		exception.HttpResponseException(c, exception.InternalError("failed to check existing plate: "+err.Error()))
		return
	}
	if existing != nil {
		exception.HttpResponseException(c, exception.EntityAlreadyExistsError(h.entity, fmt.Sprintf("number: %s", req.Number)))
		return
	}

	plate := &model.Plate{
		Number:     req.Number,
		Region:     req.Region,
		AccessType: req.AccessType,
		ValidUntil: req.ValidUntil,
		Comment:    req.Comment,
		IsEnabled:  true,
	}

	if req.IsEnabled != nil {
		plate.IsEnabled = *req.IsEnabled
	}

	if err := h.plate.repo.Create(plate); err != nil {
		exception.HttpResponseException(c, exception.InternalError("failed plate creating: "+err.Error()))
		return
	}

	c.JSON(http.StatusCreated, plate)
}

func (h *PlateHandler) GetPlate(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		exception.HttpResponseException(c, exception.RequestValidationError("invalid uuid format"))
		return
	}

	plate, err := h.plate.repo.Find(id)
	if err != nil {
		exception.HttpResponseException(c, exception.InternalError("failed find plate: "+err.Error()))
		return
	}

	if plate == nil {
		exception.HttpResponseException(c, exception.EntityNotFoundError(h.entity, fmt.Sprintf("id: %s", id)))
		return
	}

	c.JSON(http.StatusOK, plate)
}

func (h *PlateHandler) UpdatePlate(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		exception.HttpResponseException(c, exception.RequestValidationError("invalid uuid format"))
		return
	}

	var req model.UpdatePlateRequest
	if err := h.validateRequestBody(c, &req); err != nil {
		exception.HttpResponseException(c, exception.RequestValidationError(err.Error()))
		return
	}

	plate, err := h.plate.repo.Find(id)
	if err != nil {
		exception.HttpResponseException(c, exception.InternalError("failed find plate: "+err.Error()))
		return
	}

	if plate == nil {
		exception.HttpResponseException(c, exception.EntityNotFoundError(h.entity, fmt.Sprintf("id: %s", id)))
		return
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
	if req.IsEnabled != nil {
		plate.IsEnabled = *req.IsEnabled
	}

	if err := h.plate.repo.Update(plate); err != nil {
		exception.HttpResponseException(c, exception.InternalError("failed update plate: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, plate)
}

func (h *PlateHandler) DeletePlate(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		exception.HttpResponseException(c, exception.RequestValidationError("invalid uuid format"))
		return
	}

	plate, err := h.plate.repo.Find(id)
	if err != nil {
		exception.HttpResponseException(c, exception.InternalError("failed find plate: "+err.Error()))
		return
	}

	if plate == nil {
		exception.HttpResponseException(c, exception.EntityNotFoundError(h.entity, fmt.Sprintf("id: %s", id)))
		return
	}

	if err := h.plate.repo.Delete(id); err != nil {
		exception.HttpResponseException(c, exception.InternalError("failed plate delete: "+err.Error()))
		return
	}

	c.Status(http.StatusNoContent)
}

func (h *PlateHandler) ListPlates(c *gin.Context) {
	filters := &repository.PlateFilters{}

	if number := c.Query("number"); number != "" {
		filters.Number = &number
	}

	if isEnabledStr := c.Query("isEnabled"); isEnabledStr != "" {
		if isEnabledStr == "true" {
			isEnabled := true
			filters.IsEnabled = &isEnabled
		} else if isEnabledStr == "false" {
			isEnabled := false
			filters.IsEnabled = &isEnabled
		}
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	if limit <= 0 {
		limit = 10
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	filters.Limit = limit
	filters.Offset = offset

	plates, err := h.plate.repo.List(filters)
	if err != nil {
		exception.HttpResponseException(c, exception.InternalError("failed plate list: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, plates)
}

func (h *PlateHandler) validateRequestBody(c *gin.Context, req any) error {
	if err := c.ShouldBindJSON(req); err != nil {
		return err
	}
	if err := h.validate.Struct(req); err != nil {
		return err
	}
	return nil
}

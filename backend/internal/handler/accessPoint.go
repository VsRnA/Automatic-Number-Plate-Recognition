package handler

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"

	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/exception"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/model"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/repository"
)

type IAccessPointHandler interface {
	CreateAccessPoint(c *gin.Context)
	GetAccessPoint(c *gin.Context)
	UpdateAccessPoint(c *gin.Context)
	DeleteAccessPoint(c *gin.Context)
	ListAccessPoints(c *gin.Context)
}

type AccessPointHandler struct {
	repo     repository.IAccessPointRepository
	validate *validator.Validate
	entity   string
}

func NewAccessPointHandler(repo repository.IAccessPointRepository, validate *validator.Validate) IAccessPointHandler {
	return &AccessPointHandler{
		repo:     repo,
		validate: validate,
		entity:   "access_point",
	}
}

func (h *AccessPointHandler) CreateAccessPoint(c *gin.Context) {
	var req model.CreateAccessPointRequest
	if err := h.validateBody(c, &req); err != nil {
		exception.HttpResponseException(c, exception.RequestValidationError(err.Error()))
		return
	}

	existing, err := h.repo.Get(&repository.AccessPointFilters{Name: &req.Name})
	if err != nil {
		exception.HttpResponseException(c, exception.InternalError("failed to check existing access point: "+err.Error()))
		return
	}
	if existing != nil {
		exception.HttpResponseException(c, exception.EntityAlreadyExistsError(h.entity, fmt.Sprintf("name: %s", req.Name)))
		return
	}

	ap := &model.AccessPoint{
		Name:        req.Name,
		Description: req.Description,
		Direction:   "both",
		IsEnabled:   true,
	}
	if req.Direction != "" {
		ap.Direction = req.Direction
	}
	if req.IsEnabled != nil {
		ap.IsEnabled = *req.IsEnabled
	}

	if err := h.repo.Create(ap); err != nil {
		exception.HttpResponseException(c, exception.InternalError("failed to create access point: "+err.Error()))
		return
	}

	c.JSON(http.StatusCreated, ap)
}

func (h *AccessPointHandler) GetAccessPoint(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		exception.HttpResponseException(c, exception.RequestValidationError("invalid id format"))
		return
	}

	ap, err := h.repo.Find(id)
	if err != nil {
		exception.HttpResponseException(c, exception.InternalError("failed to find access point: "+err.Error()))
		return
	}
	if ap == nil {
		exception.HttpResponseException(c, exception.EntityNotFoundError(h.entity, fmt.Sprintf("id: %d", id)))
		return
	}

	c.JSON(http.StatusOK, ap)
}

func (h *AccessPointHandler) UpdateAccessPoint(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		exception.HttpResponseException(c, exception.RequestValidationError("invalid id format"))
		return
	}

	var req model.UpdateAccessPointRequest
	if err := h.validateBody(c, &req); err != nil {
		exception.HttpResponseException(c, exception.RequestValidationError(err.Error()))
		return
	}

	ap, err := h.repo.Find(id)
	if err != nil {
		exception.HttpResponseException(c, exception.InternalError("failed to find access point: "+err.Error()))
		return
	}
	if ap == nil {
		exception.HttpResponseException(c, exception.EntityNotFoundError(h.entity, fmt.Sprintf("id: %d", id)))
		return
	}

	if req.Name != "" {
		ap.Name = req.Name
	}
	if req.Description != "" {
		ap.Description = req.Description
	}
	if req.Direction != "" {
		ap.Direction = req.Direction
	}
	if req.IsEnabled != nil {
		ap.IsEnabled = *req.IsEnabled
	}

	if err := h.repo.Update(ap); err != nil {
		exception.HttpResponseException(c, exception.InternalError("failed to update access point: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, ap)
}

func (h *AccessPointHandler) DeleteAccessPoint(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		exception.HttpResponseException(c, exception.RequestValidationError("invalid id format"))
		return
	}

	ap, err := h.repo.Find(id)
	if err != nil {
		exception.HttpResponseException(c, exception.InternalError("failed to find access point: "+err.Error()))
		return
	}
	if ap == nil {
		exception.HttpResponseException(c, exception.EntityNotFoundError(h.entity, fmt.Sprintf("id: %d", id)))
		return
	}

	if err := h.repo.Delete(id); err != nil {
		exception.HttpResponseException(c, exception.InternalError("failed to delete access point: "+err.Error()))
		return
	}

	c.Status(http.StatusNoContent)
}

func (h *AccessPointHandler) ListAccessPoints(c *gin.Context) {
	filters := &repository.AccessPointFilters{}

	if name := c.Query("name"); name != "" {
		filters.Name = &name
	}
	if isEnabledStr := c.Query("isEnabled"); isEnabledStr != "" {
		if isEnabledStr == "true" {
			v := true
			filters.IsEnabled = &v
		} else if isEnabledStr == "false" {
			v := false
			filters.IsEnabled = &v
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

	aps, err := h.repo.List(filters)
	if err != nil {
		exception.HttpResponseException(c, exception.InternalError("failed to list access points: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, aps)
}

func (h *AccessPointHandler) validateBody(c *gin.Context, req any) error {
	if err := c.ShouldBindJSON(req); err != nil {
		return err
	}
	return h.validate.Struct(req)
}

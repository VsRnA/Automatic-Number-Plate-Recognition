package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"

	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/exception"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/model"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/service"
)

type IPlateHandler interface {
	CreatePlate(c *gin.Context)
	GetPlate(c *gin.Context)
	UpdatePlate(c *gin.Context)
	DeletePlate(c *gin.Context)
	ListPlates(c *gin.Context)
}

type PlateHandler struct {
	service  service.IPlateService
	validate *validator.Validate
}

func NewPlateHandler(svc service.IPlateService, validate *validator.Validate) IPlateHandler {
	return &PlateHandler{
		service:  svc,
		validate: validate,
	}
}

func (h *PlateHandler) CreatePlate(c *gin.Context) {
	var req model.CreatePlateRequest
	if err := h.validateRequestBody(c, &req); err != nil {
		exception.HttpResponseException(c, exception.RequestValidationError(err.Error()))
		return
	}

	plate, apiErr := h.service.CreatePlate(&req)
	if apiErr != nil {
		exception.HttpResponseException(c, apiErr)
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

	plate, apiErr := h.service.GetPlate(id)
	if apiErr != nil {
		exception.HttpResponseException(c, apiErr)
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

	plate, apiErr := h.service.UpdatePlate(id, &req)
	if apiErr != nil {
		exception.HttpResponseException(c, apiErr)
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

	apiErr := h.service.DeletePlate(id)
	if apiErr != nil {
		exception.HttpResponseException(c, apiErr)
		return
	}

	c.Status(http.StatusNoContent)
}

func (h *PlateHandler) ListPlates(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	plates, apiErr := h.service.ListPlates(limit, offset)
	if apiErr != nil {
		exception.HttpResponseException(c, apiErr)
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

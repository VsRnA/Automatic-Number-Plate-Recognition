package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"

	"github.com/VsRnA/Automatic-Number-Plate-Recognition/infrastructure"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/exception"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/model"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/repository"
)

type ICameraHandler interface {
	CreateCamera(c *gin.Context)
	GetCamera(c *gin.Context)
	UpdateCamera(c *gin.Context)
	DeleteCamera(c *gin.Context)
	ListCameras(c *gin.Context)
}

type CameraHandler struct {
	camera   *cameraDeps
	validate *validator.Validate
	entity   string
}

type cameraDeps struct {
	repo              repository.ICameraRepository
	recognitionClient *infrastructure.RecognitionClient
}

func NewCameraHandler(repo repository.ICameraRepository, recognitionClient *infrastructure.RecognitionClient, validate *validator.Validate) ICameraHandler {
	return &CameraHandler{
		camera: &cameraDeps{
			repo:              repo,
			recognitionClient: recognitionClient,
		},
		validate: validate,
		entity:   "camera",
	}
}

func (h *CameraHandler) CreateCamera(c *gin.Context) {
	var req model.CreateCameraRequest
	if err := h.validateRequestBody(c, &req); err != nil {
		exception.HttpResponseException(c, exception.RequestValidationError(err.Error()))
		return
	}

	existing, err := h.camera.repo.Get(&repository.CameraFilters{Name: &req.Name})
	if err != nil {
		exception.HttpResponseException(c, exception.InternalError("failed to check existing camera: "+err.Error()))
		return
	}
	if existing != nil {
		exception.HttpResponseException(c, exception.EntityAlreadyExistsError(h.entity, fmt.Sprintf("name: %s", req.Name)))
		return
	}

	camera := &model.Camera{
		Name:          req.Name,
		Stream:        req.Stream,
		StreamHd:      req.StreamHd,
		Login:         req.Login,
		Password:      req.Password,
		AccessPointId: req.AccessPointId,
		IsEnabled:     false,
	}

	if req.Metadata != nil {
		metadataBytes, err := json.Marshal(req.Metadata)
		if err != nil {
			exception.HttpResponseException(c, exception.InternalError("failed to marshal metadata: "+err.Error()))
			return
		}
		camera.Metadata = metadataBytes
	}

	if req.IsEnabled != nil {
		camera.IsEnabled = *req.IsEnabled
	}

	if err := h.camera.repo.Create(camera); err != nil {
		exception.HttpResponseException(c, exception.InternalError("failed camera creating: "+err.Error()))
		return
	}

	if camera.IsEnabled {
		if err := h.startWorker(c.Request.Context(), camera); err != nil {
			log.Printf("Warning: failed to start worker for camera %s: %v", camera.Guid, err)
		}
	}

	c.JSON(http.StatusCreated, camera)
}

func (h *CameraHandler) GetCamera(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		exception.HttpResponseException(c, exception.RequestValidationError("invalid uuid format"))
		return
	}

	camera, err := h.camera.repo.Find(id)
	if err != nil {
		exception.HttpResponseException(c, exception.InternalError("failed find camera: "+err.Error()))
		return
	}

	if camera == nil {
		exception.HttpResponseException(c, exception.EntityNotFoundError(h.entity, fmt.Sprintf("id: %s", id)))
		return
	}

	c.JSON(http.StatusOK, camera)
}

func (h *CameraHandler) UpdateCamera(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		exception.HttpResponseException(c, exception.RequestValidationError("invalid uuid format"))
		return
	}

	var req model.UpdateCameraRequest
	if err := h.validateRequestBody(c, &req); err != nil {
		exception.HttpResponseException(c, exception.RequestValidationError(err.Error()))
		return
	}

	camera, err := h.camera.repo.Find(id)
	if err != nil {
		exception.HttpResponseException(c, exception.InternalError("failed find camera: "+err.Error()))
		return
	}

	if camera == nil {
		exception.HttpResponseException(c, exception.EntityNotFoundError(h.entity, fmt.Sprintf("id: %s", id)))
		return
	}

	wasEnabled := camera.IsEnabled

	if req.Name != "" {
		camera.Name = req.Name
	}
	if req.Stream != "" {
		camera.Stream = req.Stream
	}
	if req.StreamHd != "" {
		camera.StreamHd = req.StreamHd
	}
	if req.Login != nil {
		camera.Login = req.Login
	}
	if req.Password != nil {
		camera.Password = req.Password
	}
	if req.AccessPointId != nil {
		camera.AccessPointId = req.AccessPointId
	}
	if req.IsEnabled != nil {
		camera.IsEnabled = *req.IsEnabled
	}
	if req.Metadata != nil {
		metadataBytes, err := json.Marshal(req.Metadata)
		if err != nil {
			exception.HttpResponseException(c, exception.InternalError("failed to marshal metadata: "+err.Error()))
			return
		}
		camera.Metadata = metadataBytes
	}

	if err := h.camera.repo.Update(camera); err != nil {
		exception.HttpResponseException(c, exception.InternalError("failed update camera: "+err.Error()))
		return
	}

	if req.IsEnabled != nil && wasEnabled != camera.IsEnabled {
		if camera.IsEnabled {
			if err := h.startWorker(c.Request.Context(), camera); err != nil {
				log.Printf("Warning: failed to start worker for camera %s: %v", camera.Guid, err)
			}
		} else {
			if err := h.stopWorker(c.Request.Context(), camera.Guid.String()); err != nil {
				log.Printf("Warning: failed to stop worker for camera %s: %v", camera.Guid, err)
			}
		}
	}

	c.JSON(http.StatusOK, camera)
}

func (h *CameraHandler) DeleteCamera(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		exception.HttpResponseException(c, exception.RequestValidationError("invalid uuid format"))
		return
	}

	camera, err := h.camera.repo.Find(id)
	if err != nil {
		exception.HttpResponseException(c, exception.InternalError("failed find camera: "+err.Error()))
		return
	}

	if camera == nil {
		exception.HttpResponseException(c, exception.EntityNotFoundError(h.entity, fmt.Sprintf("id: %s", id)))
		return
	}

	if camera.IsEnabled {
		if err := h.stopWorker(c.Request.Context(), camera.Guid.String()); err != nil {
			log.Printf("Warning: failed to stop worker for camera %s: %v", camera.Guid, err)
		}
	}

	if err := h.camera.repo.Delete(id); err != nil {
		exception.HttpResponseException(c, exception.InternalError("failed camera delete: "+err.Error()))
		return
	}

	c.Status(http.StatusNoContent)
}

func (h *CameraHandler) ListCameras(c *gin.Context) {
	filters := &repository.CameraFilters{}

	if isEnabledStr := c.Query("isEnabled"); isEnabledStr != "" {
		if isEnabledStr == "true" {
			isEnabled := true
			filters.IsEnabled = &isEnabled
		} else if isEnabledStr == "false" {
			isEnabled := false
			filters.IsEnabled = &isEnabled
		}
	}

	if name := c.Query("name"); name != "" {
		filters.Name = &name
	}

	if accessPointIdStr := c.Query("accessPointId"); accessPointIdStr != "" {
		if accessPointId, err := strconv.Atoi(accessPointIdStr); err == nil {
			filters.AccessPointId = &accessPointId
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

	cameras, err := h.camera.repo.List(filters)
	if err != nil {
		exception.HttpResponseException(c, exception.InternalError("failed camera list: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, cameras)
}

func (h *CameraHandler) validateRequestBody(c *gin.Context, req any) error {
	if err := c.ShouldBindJSON(req); err != nil {
		return err
	}
	if err := h.validate.Struct(req); err != nil {
		return err
	}
	return nil
}

func (h *CameraHandler) startWorker(ctx context.Context, camera *model.Camera) error {
	if h.camera.recognitionClient == nil {
		return fmt.Errorf("recognition client not available")
	}

	resp, err := h.camera.recognitionClient.StartWorker(ctx, camera.Guid.String(), camera.StreamHd)
	if err != nil {
		return err
	}

	if !resp.Success {
		return fmt.Errorf("failed to start worker: %s", resp.Error)
	}

	log.Printf("Started worker for camera %s: %s", camera.Guid, resp.Message)
	return nil
}

func (h *CameraHandler) stopWorker(ctx context.Context, cameraID string) error {
	if h.camera.recognitionClient == nil {
		return fmt.Errorf("recognition client not available")
	}

	resp, err := h.camera.recognitionClient.StopWorker(ctx, cameraID)
	if err != nil {
		return err
	}

	if !resp.Success {
		return fmt.Errorf("failed to stop worker: %s", resp.Error)
	}

	log.Printf("Stopped worker for camera %s: %s", cameraID, resp.Message)
	return nil
}

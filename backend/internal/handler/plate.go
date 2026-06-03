package handler

import (
	"encoding/csv"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/exception"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/model"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/repository"
)

type IPlateHandler interface {
	CreatePlate(c *gin.Context)
	ImportPlates(c *gin.Context)
	PreviewImportPlates(c *gin.Context)
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
	repo    repository.IPlateRepository
	papRepo repository.IPlateAccessPointRepository
	db      *gorm.DB
}

func NewPlateHandler(repo repository.IPlateRepository, papRepo repository.IPlateAccessPointRepository, validate *validator.Validate, db *gorm.DB) IPlateHandler {
	return &PlateHandler{
		plate: &plateDeps{
			repo:    repo,
			papRepo: papRepo,
			db:      db,
		},
		validate: validate,
		entity:   "plate",
	}
}

func (h *PlateHandler) buildResponse(plate *model.Plate) model.PlateResponse {
	resp := model.PlateResponse{
		Guid:           plate.Guid,
		Number:         plate.Number,
		Region:         plate.Region,
		AccessType:     plate.AccessType,
		ValidUntil:     plate.ValidUntil,
		Comment:        plate.Comment,
		IsEnabled:      plate.IsEnabled,
		CreatedAt:      plate.CreatedAt,
		AccessPointIds: []int{},
	}

	items, err := h.plate.papRepo.List(&repository.PlateAccessPointFilters{PlateGuid: &plate.Guid})
	if err == nil {
		for _, item := range items {
			resp.AccessPointIds = append(resp.AccessPointIds, item.AccessPointId)
		}
	}

	return resp
}

func (h *PlateHandler) syncAccessPoints(papRepo repository.IPlateAccessPointRepository, plateGuid uuid.UUID, ids []int) error {
	if err := papRepo.DeleteByPlate(plateGuid); err != nil {
		return err
	}
	for _, apId := range ids {
		if err := papRepo.Create(&model.PlateAccessPoint{
			PlateGuid:     plateGuid,
			AccessPointId: apId,
		}); err != nil {
			return err
		}
	}
	return nil
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

	accessType, ok := normalizeAccessType(req.AccessType)
	if !ok {
		exception.HttpResponseException(c, exception.RequestValidationError("accessType must be allowed or blocked"))
		return
	}

	plate := &model.Plate{
		Number:     req.Number,
		Region:     req.Region,
		AccessType: accessType,
		ValidUntil: req.ValidUntil,
		Comment:    req.Comment,
		IsEnabled:  true,
	}

	if req.IsEnabled != nil {
		plate.IsEnabled = *req.IsEnabled
	}

	if err := h.plate.db.Transaction(func(tx *gorm.DB) error {
		plateRepo := repository.NewPlateRepository(tx)
		papRepo := repository.NewPlateAccessPointRepository(tx)
		if err := plateRepo.Create(plate); err != nil {
			return err
		}
		if len(req.AccessPointIds) > 0 {
			return h.syncAccessPoints(papRepo, plate.Guid, req.AccessPointIds)
		}
		return nil
	}); err != nil {
		exception.HttpResponseException(c, exception.InternalError("failed plate creating: "+err.Error()))
		return
	}

	c.JSON(http.StatusCreated, h.buildResponse(plate))
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

	c.JSON(http.StatusOK, h.buildResponse(plate))
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
		accessType, ok := normalizeAccessType(req.AccessType)
		if !ok {
			exception.HttpResponseException(c, exception.RequestValidationError("accessType must be allowed or blocked"))
			return
		}
		plate.AccessType = accessType
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

	if err := h.plate.db.Transaction(func(tx *gorm.DB) error {
		plateRepo := repository.NewPlateRepository(tx)
		if err := plateRepo.Update(plate); err != nil {
			return err
		}
		if req.AccessPointIds != nil {
			papRepo := repository.NewPlateAccessPointRepository(tx)
			return h.syncAccessPoints(papRepo, plate.Guid, *req.AccessPointIds)
		}
		return nil
	}); err != nil {
		exception.HttpResponseException(c, exception.InternalError("failed update plate: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, h.buildResponse(plate))
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

	responses := make([]model.PlateResponse, 0, len(plates))
	for i := range plates {
		responses = append(responses, h.buildResponse(&plates[i]))
	}

	c.JSON(http.StatusOK, responses)
}

func (h *PlateHandler) ImportPlates(c *gin.Context) {
	file, _, err := c.Request.FormFile("file")
	if err != nil {
		exception.HttpResponseException(c, exception.RequestValidationError("file is required"))
		return
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.TrimLeadingSpace = true
	reader.Comma = ';'

	if _, err := reader.Read(); err != nil {
		exception.HttpResponseException(c, exception.RequestValidationError("failed to read CSV header"))
		return
	}

	var created, skipped int
	for {
		row, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			continue
		}
		if len(row) < 3 {
			skipped++
			continue
		}

		number := strings.TrimSpace(row[0])
		region := ""
		if len(row) > 1 {
			region = strings.TrimSpace(row[1])
		}
		accessType, ok := normalizeAccessType(row[2])
		if number == "" || !ok {
			skipped++
			continue
		}

		existing, _ := h.plate.repo.Get(&repository.PlateFilters{Number: &number})
		if existing != nil {
			skipped++
			continue
		}

		plate := &model.Plate{
			Number:     number,
			Region:     region,
			AccessType: accessType,
			IsEnabled:  true,
		}

		if len(row) > 3 && strings.TrimSpace(row[3]) != "" {
			if t, err := time.Parse(time.RFC3339, strings.TrimSpace(row[3])); err == nil {
				plate.ValidUntil = &t
			}
		}
		if len(row) > 4 {
			plate.Comment = strings.TrimSpace(row[4])
		}
		if len(row) > 5 {
			plate.IsEnabled = strings.TrimSpace(row[5]) != "false"
		}

		if err := h.plate.repo.Create(plate); err == nil {
			created++
		} else {
			skipped++
		}
	}

	c.JSON(http.StatusOK, gin.H{"created": created, "skipped": skipped})
}

var validAccessTypes = map[string]bool{"allowed": true, "blocked": true}

func normalizeAccessType(accessType string) (string, bool) {
	t := strings.ToLower(strings.TrimSpace(accessType))
	return t, validAccessTypes[t]
}

func (h *PlateHandler) PreviewImportPlates(c *gin.Context) {
	file, _, err := c.Request.FormFile("file")
	if err != nil {
		exception.HttpResponseException(c, exception.RequestValidationError("file is required"))
		return
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.TrimLeadingSpace = true
	reader.Comma = ';'

	if _, err := reader.Read(); err != nil {
		exception.HttpResponseException(c, exception.RequestValidationError("failed to read CSV header"))
		return
	}

	rows := make([]model.ImportPreviewRow, 0)
	rowNum := 0
	totalOk, totalDuplicates, totalInvalid := 0, 0, 0

	for {
		row, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			continue
		}
		rowNum++

		var errs model.ImportRowErrors
		var validUntil *time.Time
		number, region, accessType, comment := "", "", "", ""
		isEnabled := true

		if len(row) > 0 {
			number = strings.TrimSpace(row[0])
		}
		if len(row) > 1 {
			region = strings.TrimSpace(row[1])
		}
		if len(row) > 2 {
			accessType = strings.ToLower(strings.TrimSpace(row[2]))
		}
		if len(row) > 3 && strings.TrimSpace(row[3]) != "" {
			if t, parseErr := time.Parse(time.RFC3339, strings.TrimSpace(row[3])); parseErr == nil {
				validUntil = &t
			} else {
				errs.ValidUntil = "invalid_format"
			}
		}
		if len(row) > 4 {
			comment = strings.TrimSpace(row[4])
		}
		if len(row) > 5 {
			isEnabled = strings.TrimSpace(row[5]) != "false"
		}

		if number == "" {
			errs.Number = "required"
		} else if len(number) > 20 {
			errs.Number = "too_long"
		}
		if len(region) > 10 {
			errs.Region = "too_long"
		}
		if accessType == "" {
			errs.AccessType = "required"
		} else if !validAccessTypes[strings.ToLower(accessType)] {
			errs.AccessType = "invalid_value"
		}

		status := "ok"
		hasErrors := errs.Number != "" || errs.Region != "" || errs.AccessType != "" || errs.ValidUntil != ""
		if hasErrors {
			status = "invalid"
			totalInvalid++
		} else {
			existing, _ := h.plate.repo.Get(&repository.PlateFilters{Number: &number})
			if existing != nil {
				errs.Number = "duplicate"
				status = "duplicate"
				totalDuplicates++
			} else {
				totalOk++
			}
		}

		rows = append(rows, model.ImportPreviewRow{
			Row:        rowNum,
			Number:     number,
			Region:     region,
			AccessType: accessType,
			ValidUntil: validUntil,
			Comment:    comment,
			IsEnabled:  isEnabled,
			Errors:     errs,
			Status:     status,
		})
	}

	c.JSON(http.StatusOK, model.ImportPreviewResponse{
		Rows:            rows,
		TotalOk:         totalOk,
		TotalDuplicates: totalDuplicates,
		TotalInvalid:    totalInvalid,
	})
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

package handler

import (
	"encoding/csv"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/exception"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/repository"
)

type IRecognitionHistoryHandler interface {
	ListHistory(c *gin.Context)
	ExportHistoryCSV(c *gin.Context)
}

type RecognitionHistoryHandler struct {
	repo repository.IRecognitionHistoryRepository
}

func NewRecognitionHistoryHandler(repo repository.IRecognitionHistoryRepository) IRecognitionHistoryHandler {
	return &RecognitionHistoryHandler{repo: repo}
}

func (h *RecognitionHistoryHandler) ListHistory(c *gin.Context) {
	filters := h.parseFilters(c)

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}
	filters.Limit = limit
	filters.Offset = offset

	records, err := h.repo.List(filters)
	if err != nil {
		exception.HttpResponseException(c, exception.InternalError("failed to list recognition history: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, records)
}

func (h *RecognitionHistoryHandler) ExportHistoryCSV(c *gin.Context) {
	filters := h.parseFilters(c)

	records, err := h.repo.List(filters)
	if err != nil {
		exception.HttpResponseException(c, exception.InternalError("failed to export recognition history: "+err.Error()))
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=recognition_history.csv")

	w := csv.NewWriter(c.Writer)
	_ = w.Write([]string{"id", "plateNumber", "accessGranted", "confidence", "cameraGuid", "accessPointId", "snapshotUrl", "occurredAt"})

	for _, r := range records {
		accessGranted := ""
		if r.AccessGranted != nil {
			if *r.AccessGranted {
				accessGranted = "true"
			} else {
				accessGranted = "false"
			}
		}
		accessPointId := ""
		if r.AccessPointId != nil {
			accessPointId = strconv.Itoa(*r.AccessPointId)
		}
		_ = w.Write([]string{
			r.ID.String(),
			r.PlateNumber,
			accessGranted,
			strconv.FormatFloat(r.Confidence, 'f', 4, 64),
			r.CameraGuid.String(),
			accessPointId,
			r.SnapshotUrl,
			r.OccurredAt.Format(time.RFC3339),
		})
	}

	w.Flush()
}

func (h *RecognitionHistoryHandler) parseFilters(c *gin.Context) *repository.RecognitionHistoryFilters {
	filters := &repository.RecognitionHistoryFilters{}

	if cameraGuidStr := c.Query("cameraGuid"); cameraGuidStr != "" {
		if id, err := uuid.Parse(cameraGuidStr); err == nil {
			filters.CameraGuid = &id
		}
	}

	if accessPointIdStr := c.Query("accessPointId"); accessPointIdStr != "" {
		if id, err := strconv.Atoi(accessPointIdStr); err == nil {
			filters.AccessPointId = &id
		}
	}

	if plateNumber := c.Query("plateNumber"); plateNumber != "" {
		filters.PlateNumber = &plateNumber
	}

	if accessGrantedStr := c.Query("accessGranted"); accessGrantedStr != "" {
		if accessGrantedStr == "true" {
			v := true
			filters.AccessGranted = &v
		} else if accessGrantedStr == "false" {
			v := false
			filters.AccessGranted = &v
		}
	}

	if dateFromStr := c.Query("dateFrom"); dateFromStr != "" {
		if t, err := time.Parse(time.RFC3339, dateFromStr); err == nil {
			filters.DateFrom = &t
		}
	}

	if dateToStr := c.Query("dateTo"); dateToStr != "" {
		if t, err := time.Parse(time.RFC3339, dateToStr); err == nil {
			filters.DateTo = &t
		}
	}

	return filters
}

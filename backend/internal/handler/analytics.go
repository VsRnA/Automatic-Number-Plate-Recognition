package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/exception"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/repository"
)

type IAnalyticsHandler interface {
	GetDashboard(c *gin.Context)
}

type AnalyticsHandler struct {
	repo repository.IAnalyticsRepository
}

func NewAnalyticsHandler(repo repository.IAnalyticsRepository) IAnalyticsHandler {
	return &AnalyticsHandler{repo: repo}
}

func (h *AnalyticsHandler) GetDashboard(c *gin.Context) {
	timelineDays := parseTimelineDays(c.Query("period"))
	data, err := h.repo.GetDashboard(timelineDays)
	if err != nil {
		exception.HttpResponseException(c, exception.InternalError("failed to load analytics"))
		return
	}
	c.JSON(http.StatusOK, data)
}

func parseTimelineDays(period string) int {
	switch period {
	case "7d":
		return 7
	case "90d":
		return 90
	default:
		return 30
	}
}

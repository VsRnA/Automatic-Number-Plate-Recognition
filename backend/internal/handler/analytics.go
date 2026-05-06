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
	data, err := h.repo.GetDashboard()
	if err != nil {
		exception.HttpResponseException(c, exception.InternalError("failed to load analytics"))
		return
	}
	c.JSON(http.StatusOK, data)
}

package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/VsRnA/Automatic-Number-Plate-Recognition/infrastructure"
)

type IRecognitionHandler interface {
	HealthCheck(c *gin.Context)
	Ping(c *gin.Context)
	TestRecognize(c *gin.Context)
}

type RecognitionHandler struct {
	client *infrastructure.RecognitionClient
}

func NewRecognitionHandler(client *infrastructure.RecognitionClient) *RecognitionHandler {
	return &RecognitionHandler{
		client: client,
	}
}

type PingRequest struct {
	Message string `json:"message" binding:"required"`
}

type TestRecognizeRequest struct {
	ImageBase64    string `json:"imageBase64"`
	UseSampleImage bool   `json:"useSampleImage"`
}

func (h *RecognitionHandler) HealthCheck(c *gin.Context) {
	resp, err := h.client.HealthCheck(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "Recognition service unavailable",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"healthy":   resp.Healthy,
		"version":   resp.Version,
		"timestamp": resp.Timestamp,
	})
}

func (h *RecognitionHandler) Ping(c *gin.Context) {
	var req PingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resp, err := h.client.Ping(c.Request.Context(), req.Message)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "Recognition service unavailable",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   resp.Message,
		"timestamp": resp.Timestamp,
	})
}

func (h *RecognitionHandler) TestRecognize(c *gin.Context) {
	var req TestRecognizeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resp, err := h.client.TestRecognize(c.Request.Context(), req.ImageBase64, req.UseSampleImage)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "Recognition service unavailable",
			"details": err.Error(),
		})
		return
	}

	plates := make([]gin.H, 0, len(resp.Plates))
	for _, p := range resp.Plates {
		plates = append(plates, gin.H{
			"plateNumber": p.PlateNumber,
			"confidence":  p.Confidence,
			"boundingBox": gin.H{
				"x":      p.BoundingBox.X,
				"y":      p.BoundingBox.Y,
				"width":  p.BoundingBox.Width,
				"height": p.BoundingBox.Height,
			},
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success":          resp.Success,
		"plates":           plates,
		"processingTimeMs": resp.ProcessingTimeMs,
		"error":            resp.Error,
	})
}

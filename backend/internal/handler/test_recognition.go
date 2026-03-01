package handler

import (
	"io"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/VsRnA/Automatic-Number-Plate-Recognition/infrastructure"
)

const maxVideoSize = 256 << 20 // 256 MB

type ITestRecognitionHandler interface {
	RecognizeVideo(c *gin.Context)
}

type TestRecognitionHandler struct {
	client *infrastructure.RecognitionClient
}

func NewTestRecognitionHandler(client *infrastructure.RecognitionClient) *TestRecognitionHandler {
	return &TestRecognitionHandler{client: client}
}

// RecognizeVideo godoc
// POST /api/v1/test/recognize-video
// Принимает видеофайл multipart/form-data (поле "video"),
// отправляет байты в Python сервис через gRPC,
// возвращает список детектированных номеров с URL скриншотов из S3.
func (h *TestRecognitionHandler) RecognizeVideo(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxVideoSize)

	file, _, err := c.Request.FormFile("video")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "video file is required (multipart field: video)"})
		return
	}
	defer file.Close()

	videoData, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read video file"})
		return
	}

	cameraID := c.Query("cameraId")

	resp, err := h.client.TestRecognizeVideo(c.Request.Context(), videoData, 0, cameraID)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "recognition service unavailable",
			"details": err.Error(),
		})
		return
	}

	if !resp.Success {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": resp.Error})
		return
	}

	detections := make([]gin.H, 0, len(resp.Detections))
	for _, d := range resp.Detections {
		detections = append(detections, gin.H{
			"plateNumber":   d.PlateNumber,
			"confidence":    d.Confidence,
			"screenshotUrl": d.ScreenshotUrl,
			"frameNumber":   d.FrameNumber,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success":              true,
		"totalFramesWithPlates": resp.TotalFramesProcessed,
		"detections":           detections,
	})
}

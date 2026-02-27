package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"github.com/VsRnA/Automatic-Number-Plate-Recognition/infrastructure"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/exception"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/model"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/repository"
)

type IStreamHandler interface {
	StartStream(c *gin.Context)
	StopStream(c *gin.Context)
	GetStreamStatus(c *gin.Context)
	ServeHLS(c *gin.Context)
	StreamEvents(c *gin.Context)
}

type StreamHandler struct {
	cameraRepo        repository.ICameraRepository
	ffmpeg            *infrastructure.FFmpegManager
	redisClient       *redis.Client
	redisStreamPrefix string
}

func NewStreamHandler(
	cameraRepo repository.ICameraRepository,
	ffmpeg *infrastructure.FFmpegManager,
	redisClient *redis.Client,
	redisStreamPrefix string,
) IStreamHandler {
	return &StreamHandler{
		cameraRepo:        cameraRepo,
		ffmpeg:            ffmpeg,
		redisClient:       redisClient,
		redisStreamPrefix: redisStreamPrefix,
	}
}

func (h *StreamHandler) StartStream(c *gin.Context) {
	camera, apiErr := h.findCamera(c)
	if apiErr != nil {
		exception.HttpResponseException(c, apiErr)
		return
	}

	if err := h.ffmpeg.Start(camera.Guid.String(), camera.Stream); err != nil {
		exception.HttpResponseException(c, exception.InternalError("failed to start stream: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "stream started"})
}

func (h *StreamHandler) StopStream(c *gin.Context) {
	camera, apiErr := h.findCamera(c)
	if apiErr != nil {
		exception.HttpResponseException(c, apiErr)
		return
	}

	if err := h.ffmpeg.Stop(camera.Guid.String()); err != nil {
		exception.HttpResponseException(c, exception.InternalError("failed to stop stream: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "stream stopped"})
}

func (h *StreamHandler) GetStreamStatus(c *gin.Context) {
	camera, apiErr := h.findCamera(c)
	if apiErr != nil {
		exception.HttpResponseException(c, apiErr)
		return
	}

	s := h.ffmpeg.Status(camera.Guid.String())
	startedAt := ""
	if !s.StartedAt.IsZero() {
		startedAt = s.StartedAt.Format(time.RFC3339)
	}

	c.JSON(http.StatusOK, gin.H{
		"cameraId":  camera.Guid.String(),
		"status":    s.Status,
		"startedAt": startedAt,
		"error":     s.Error,
	})
}

// ServeHLS serves HLS files (.m3u8 and .ts segments) from the local HLS directory.
func (h *StreamHandler) ServeHLS(c *gin.Context) {
	cameraID := c.Param("id")
	file := c.Param("file")

	path := filepath.Join(h.ffmpeg.HLSDir(), cameraID, filepath.Clean(file))
	c.Header("Access-Control-Allow-Origin", "*")
	c.File(path)
}

// StreamEvents streams detection events for a camera from Redis via SSE.
func (h *StreamHandler) StreamEvents(c *gin.Context) {
	cameraID := c.Param("id")
	streamKey := fmt.Sprintf("%s:%s", h.redisStreamPrefix, cameraID)

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Access-Control-Allow-Origin", "*")

	ctx, cancel := context.WithCancel(c.Request.Context())
	defer cancel()

	lastID := "$"

	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	c.Stream(func(w io.Writer) bool {
		select {
		case <-ctx.Done():
			return false

		case <-ticker.C:
			fmt.Fprintf(w, ": heartbeat\n\n")
			return true

		default:
			if h.redisClient == nil {
				select {
				case <-ticker.C:
				case <-ctx.Done():
					return false
				}
				return true
			}

			entries, err := h.redisClient.XRead(ctx, &redis.XReadArgs{
				Streams: []string{streamKey, lastID},
				Count:   10,
				Block:   time.Second,
			}).Result()
			if err != nil {
				return true
			}

			for _, stream := range entries {
				for _, msg := range stream.Messages {
					lastID = msg.ID
					data, jsonErr := json.Marshal(msg.Values)
					if jsonErr != nil {
						log.Printf("StreamEvents: failed to marshal message: %v", jsonErr)
						continue
					}
					fmt.Fprintf(w, "data: %s\n\n", data)
				}
			}
			return true
		}
	})
}

func (h *StreamHandler) findCamera(c *gin.Context) (*model.Camera, *exception.ApiError) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return nil, exception.RequestValidationError("invalid uuid format")
	}

	camera, err := h.cameraRepo.Find(id)
	if err != nil {
		return nil, exception.InternalError("failed to find camera: " + err.Error())
	}
	if camera == nil {
		return nil, exception.EntityNotFoundError("camera", fmt.Sprintf("id: %s", id))
	}
	return camera, nil
}

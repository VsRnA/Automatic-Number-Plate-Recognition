package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/redis/go-redis/v9"

	"github.com/VsRnA/Automatic-Number-Plate-Recognition/infrastructure"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/config"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/repository"
)

type Handler struct {
	Plate       IPlateHandler
	Camera      ICameraHandler
	Recognition IRecognitionHandler
	Stream      IStreamHandler
	cfg         config.Config
}

func NewHandler(cfg config.Config, repo *repository.Repository, recognitionClient *infrastructure.RecognitionClient, redisClient *redis.Client, ffmpegManager *infrastructure.FFmpegManager) *Handler {
	validate := validator.New()

	return &Handler{
		Plate:       NewPlateHandler(repo.Plate, validate),
		Camera:      NewCameraHandler(repo.Camera, recognitionClient, validate),
		Recognition: NewRecognitionHandler(recognitionClient),
		Stream: NewStreamHandler(
			repo.Camera,
			ffmpegManager,
			redisClient,
			cfg.RedisStream,
		),
		cfg: cfg,
	}
}

func (h *Handler) InitRoutes() *gin.Engine {
	router := gin.New()
	router.Use(gin.Logger())
	router.Use(gin.Recovery())

	api := router.Group("/api/v1")
	{
		plates := api.Group("/plates")
		{
			plates.POST("", h.Plate.CreatePlate)
			plates.GET("", h.Plate.ListPlates)
			plates.GET("/:id", h.Plate.GetPlate)
			plates.PUT("/:id", h.Plate.UpdatePlate)
			plates.DELETE("/:id", h.Plate.DeletePlate)
		}

		cameras := api.Group("/cameras")
		{
			cameras.POST("", h.Camera.CreateCamera)
			cameras.GET("", h.Camera.ListCameras)
			cameras.GET("/:id", h.Camera.GetCamera)
			cameras.PUT("/:id", h.Camera.UpdateCamera)
			cameras.DELETE("/:id", h.Camera.DeleteCamera)

			cameras.POST("/:id/stream/start", h.Stream.StartStream)
			cameras.DELETE("/:id/stream/stop", h.Stream.StopStream)
			cameras.GET("/:id/stream/status", h.Stream.GetStreamStatus)
			cameras.GET("/:id/stream/events", h.Stream.StreamEvents)
			cameras.GET("/:id/hls/*file", h.Stream.ServeHLS)
		}

		recognition := api.Group("/recognition")
		{
			recognition.GET("/health", h.Recognition.HealthCheck)
			recognition.POST("/ping", h.Recognition.Ping)
			recognition.POST("/test", h.Recognition.TestRecognize)
		}
	}

	return router
}

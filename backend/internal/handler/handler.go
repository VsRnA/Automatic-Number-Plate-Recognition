package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"

	"github.com/VsRnA/Automatic-Number-Plate-Recognition/infrastructure"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/config"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/repository"
)

type Handler struct {
	Plate              IPlateHandler
	Camera             ICameraHandler
	Recognition        IRecognitionHandler
	TestRecognition    ITestRecognitionHandler
	AccessPoint        IAccessPointHandler
	RecognitionHistory IRecognitionHistoryHandler
	cfg                config.Config
}

func NewHandler(cfg config.Config, repo *repository.Repository, recognitionClient *infrastructure.RecognitionClient) *Handler {
	validate := validator.New()

	return &Handler{
		Plate:              NewPlateHandler(repo.Plate, validate),
		Camera:             NewCameraHandler(repo.Camera, recognitionClient, validate),
		Recognition:        NewRecognitionHandler(recognitionClient),
		TestRecognition:    NewTestRecognitionHandler(recognitionClient),
		AccessPoint:        NewAccessPointHandler(repo.AccessPoint, validate),
		RecognitionHistory: NewRecognitionHistoryHandler(repo.Recognition),
		cfg:                cfg,
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
		}

		accessPoints := api.Group("/access-points")
		{
			accessPoints.POST("", h.AccessPoint.CreateAccessPoint)
			accessPoints.GET("", h.AccessPoint.ListAccessPoints)
			accessPoints.GET("/:id", h.AccessPoint.GetAccessPoint)
			accessPoints.PUT("/:id", h.AccessPoint.UpdateAccessPoint)
			accessPoints.DELETE("/:id", h.AccessPoint.DeleteAccessPoint)
		}

		recognition := api.Group("/recognition")
		{
			recognition.GET("/health", h.Recognition.HealthCheck)
			recognition.POST("/ping", h.Recognition.Ping)
			recognition.POST("/test", h.Recognition.TestRecognize)
			recognition.GET("/list", h.RecognitionHistory.ListHistory)
		}

		test := api.Group("/test")
		{
			test.POST("/recognize-video", h.TestRecognition.RecognizeVideo)
		}
	}

	return router
}

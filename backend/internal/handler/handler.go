package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"gorm.io/gorm"

	"github.com/VsRnA/Automatic-Number-Plate-Recognition/infrastructure"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/config"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/middleware"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/repository"
)

type Handler struct {
	Plate              IPlateHandler
	Camera             ICameraHandler
	Recognition        IRecognitionHandler
	TestRecognition    ITestRecognitionHandler
	AccessPoint        IAccessPointHandler
	RecognitionHistory IRecognitionHistoryHandler
	ApiToken           IApiTokenHandler
	Analytics          IAnalyticsHandler
	cfg                config.Config
	tokenRepo          repository.IApiTokenRepository
}

func NewHandler(cfg config.Config, repo *repository.Repository, recognitionClient *infrastructure.RecognitionClient, hlsManager *infrastructure.FFmpegManager, db *gorm.DB) *Handler {
	validate := validator.New()

	return &Handler{
		Plate:              NewPlateHandler(repo.Plate, repo.PlateAccessPoint, validate, db),
		Camera:             NewCameraHandler(repo.Camera, recognitionClient, hlsManager, validate),
		Recognition:        NewRecognitionHandler(recognitionClient),
		TestRecognition:    NewTestRecognitionHandler(recognitionClient),
		AccessPoint:        NewAccessPointHandler(repo.AccessPoint, validate),
		RecognitionHistory: NewRecognitionHistoryHandler(repo.Recognition),
		ApiToken:           NewApiTokenHandler(repo.ApiToken, validate),
		Analytics:          NewAnalyticsHandler(repo.Analytics),
		cfg:                cfg,
		tokenRepo:          repo.ApiToken,
	}
}

func (h *Handler) InitRoutes() *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(middleware.StructuredLogger())
	router.Use(gin.Recovery())

	api := router.Group("/api/v1")
	api.Use(middleware.Auth(h.cfg, h.tokenRepo))
	{
		plates := api.Group("/plates")
		{
			plates.POST("", h.Plate.CreatePlate)
			plates.POST("/import", h.Plate.ImportPlates)
			plates.POST("/import/preview", h.Plate.PreviewImportPlates)
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
			cameras.GET("/:id/snapshot", h.Camera.GetSnapshot)
			cameras.GET("/:id/worker-status", h.Camera.GetWorkerStatus)
			cameras.GET("/:id/hls/index.m3u8", h.Camera.GetHLSPlaylist)
			cameras.GET("/:id/hls/:segment", h.Camera.GetHLSSegment)
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
			recognition.GET("/export", h.RecognitionHistory.ExportHistoryCSV)
			recognition.GET("/export/excel", h.RecognitionHistory.ExportHistoryExcel)
		}

		test := api.Group("/test")
		{
			test.POST("/recognize-video", h.TestRecognition.RecognizeVideo)
		}

		tokens := api.Group("/tokens")
		{
			tokens.POST("", h.ApiToken.CreateToken)
			tokens.GET("", h.ApiToken.ListTokens)
			tokens.DELETE("/:id", h.ApiToken.DeleteToken)
		}

		analytics := api.Group("/analytics")
		{
			analytics.GET("/dashboard", h.Analytics.GetDashboard)
		}
	}

	return router
}

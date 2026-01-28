package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"

	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/config"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/service"
)

type Handler struct {
	Plate IPlateHandler
	cfg   config.Config
}

func NewHandler(cfg config.Config, svc *service.Service) *Handler {
	validate := validator.New()

	return &Handler{
		Plate: NewPlateHandler(svc.Plate, validate),
		cfg:   cfg,
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
	}

	return router
}

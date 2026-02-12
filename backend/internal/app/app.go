package app

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/VsRnA/Automatic-Number-Plate-Recognition/infrastructure"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/infrastructure/database"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/config"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/handler"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/repository"
)

type App struct {
	httpServer *infrastructure.HttpServer
}

func New() *App {
	return &App{}
}

func (a *App) Run() error {
	cfg, err := config.LoadEnv()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	db, err := database.InitDB(database.DBConfig{
		Host:     cfg.DBHost,
		Port:     cfg.DBPort,
		DBName:   cfg.DBName,
		User:     cfg.DBUser,
		Password: cfg.DBPass,
		SSLMode:  cfg.DBSsl,
	})
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	recognitionClient, err := infrastructure.NewRecognitionClient(cfg.GRPCHost, cfg.GRPCPort)
	if err != nil {
		log.Printf("Warning: Failed to connect to recognition service: %v", err)
	} else {
		log.Printf("Connected to recognition service at %s:%s", cfg.GRPCHost, cfg.GRPCPort)
	}

	repositories := repository.NewRepository(db)
	handlers := handler.NewHandler(*cfg, repositories, recognitionClient)

	srv := infrastructure.NewHttpServer(cfg.HTTPPort, handlers.InitRoutes())

	go func() {
		log.Printf("HTTP Server listening on port %s", cfg.HTTPPort)
		if err := srv.Run(); err != nil {
			log.Fatalf("Error running HTTP server: %s", err.Error())
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)
	<-quit

	log.Println("Shutting down server...")

	if err := srv.Shutdown(context.Background()); err != nil {
		log.Fatalf("Error shutting down server: %s", err.Error())
	}

	sqlDB, err := db.DB()
	if err == nil {
		sqlDB.Close()
	}

	if recognitionClient != nil {
		recognitionClient.Close()
	}

	log.Println("Server stopped")
	return nil
}

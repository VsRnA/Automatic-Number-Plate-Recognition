package app

import (
	"context"
	"encoding/json"
	"log/slog"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"gorm.io/gorm"

	"github.com/VsRnA/Automatic-Number-Plate-Recognition/infrastructure"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/infrastructure/database"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/config"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/handler"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/repository"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/worker"
	pb "github.com/VsRnA/Automatic-Number-Plate-Recognition/pkg/grpc/recognition"
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
		// slog not yet configured — write to stderr and exit
		slog.New(slog.NewJSONHandler(os.Stderr, nil)).Error("Failed to load configuration", "error", err)
		os.Exit(1)
	}

	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: parseLogLevel(cfg.LogLevel),
	})).With("service", "backend"))

	db, err := database.InitDB(database.DBConfig{
		Host:     cfg.DBHost,
		Port:     cfg.DBPort,
		DBName:   cfg.DBName,
		User:     cfg.DBUser,
		Password: cfg.DBPass,
		SSLMode:  cfg.DBSsl,
	})
	if err != nil {
		slog.Error("Failed to initialize database", "error", err)
		os.Exit(1)
	}

	recognitionClient, err := infrastructure.NewRecognitionClient(cfg.GRPCHost, cfg.GRPCPort)
	if err != nil {
		slog.Warn("Failed to connect to recognition service", "host", cfg.GRPCHost, "port", cfg.GRPCPort, "error", err)
	} else {
		slog.Info("Connected to recognition service", "host", cfg.GRPCHost, "port", cfg.GRPCPort)
	}

	redisClient := infrastructure.NewRedisClient(cfg.RedisHost, cfg.RedisPort)
	slog.Info("Redis client initialized", "host", cfg.RedisHost, "port", cfg.RedisPort)

	repositories := repository.NewRepository(db)
	handlers := handler.NewHandler(*cfg, repositories, recognitionClient, db)

	srv := infrastructure.NewHttpServer(cfg.HTTPPort, handlers.InitRoutes())

	go func() {
		slog.Info("HTTP server listening", "port", cfg.HTTPPort)
		if err := srv.Run(); err != nil {
			slog.Error("Error running HTTP server", "error", err)
			os.Exit(1)
		}
	}()

	workerCtx, workerCancel := context.WithCancel(context.Background())
	recognitionWorker := worker.NewRecognitionWorker(
		repositories.Plate,
		repositories.PlateAccessPoint,
		repositories.Camera,
		repositories.Recognition,
	)
	consumer := infrastructure.NewRedisConsumer(
		redisClient,
		cfg.RedisStream,
		"anpr-backend",
		"recognition-consumer-1",
		recognitionWorker,
	)
	go consumer.Start(workerCtx)
	go runExpirationTicker(workerCtx, db, 1*time.Hour)

	if recognitionClient != nil {
		go restoreWorkers(recognitionClient, repositories.Camera)
	}

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)
	<-quit

	workerCancel()
	slog.Info("Shutting down server")

	if err := srv.Shutdown(context.Background()); err != nil {
		slog.Error("Error shutting down server", "error", err)
		os.Exit(1)
	}

	sqlDB, err := db.DB()
	if err == nil {
		sqlDB.Close()
	}

	if recognitionClient != nil {
		recognitionClient.Close()
	}

	if err := redisClient.Close(); err != nil {
		slog.Error("Error closing Redis client", "error", err)
	}

	slog.Info("Server stopped")
	return nil
}

func runExpirationTicker(ctx context.Context, db *gorm.DB, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			result := db.Exec(
				`UPDATE plates SET "isEnabled" = false WHERE "isEnabled" = true AND "validUntil" IS NOT NULL AND "validUntil" < NOW()`,
			)
			if result.Error != nil {
				slog.Error("ExpirationTicker: failed to deactivate expired plates", "error", result.Error)
			} else if result.RowsAffected > 0 {
				slog.Info("ExpirationTicker: deactivated expired plates", "count", result.RowsAffected)
			}
		}
	}
}

func restoreWorkers(client *infrastructure.RecognitionClient, cameraRepo repository.ICameraRepository) {
	const maxAttempts = 30
	const retryInterval = 5 * time.Second

	for i := 0; i < maxAttempts; i++ {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		_, err := client.HealthCheck(ctx)
		cancel()
		if err == nil {
			break
		}
		if i == maxAttempts-1 {
			slog.Error("Recognition service not available, skipping worker restore", "attempts", maxAttempts)
			return
		}
		slog.Info("Waiting for recognition service", "attempt", i+1, "max", maxAttempts)
		time.Sleep(retryInterval)
	}

	isEnabled := true
	cameras, err := cameraRepo.List(&repository.CameraFilters{IsEnabled: &isEnabled, Limit: 1000})
	if err != nil {
		slog.Error("Failed to list enabled cameras for worker restore", "error", err)
		return
	}

	for _, cam := range cameras {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		zone := extractZoneFromMetadata(cam.Metadata)
		resp, err := client.StartWorker(ctx, cam.Guid.String(), cam.StreamHd, zone)
		cancel()
		if err != nil || !resp.Success {
			slog.Warn("Failed to start worker for camera on startup", "camera_id", cam.Guid, "error", err)
		} else {
			slog.Info("Started worker for camera on startup", "camera_id", cam.Guid)
		}
	}
}

func parseLogLevel(s string) slog.Level {
	switch strings.ToLower(s) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

func extractZoneFromMetadata(metadata []byte) *pb.ZoneConfig {
	if len(metadata) == 0 {
		return nil
	}
	var meta struct {
		Zone *struct {
			Points []struct {
				X float64 `json:"x"`
				Y float64 `json:"y"`
			} `json:"points"`
			MinPlateRel float64 `json:"minPlateRel"`
			MaxPlateRel float64 `json:"maxPlateRel"`
			Tilt        int32   `json:"tilt"`
		} `json:"zone"`
	}
	if err := json.Unmarshal(metadata, &meta); err != nil || meta.Zone == nil || len(meta.Zone.Points) < 3 {
		return nil
	}
	points := make([]*pb.ZonePoint, 0, len(meta.Zone.Points))
	for _, p := range meta.Zone.Points {
		points = append(points, &pb.ZonePoint{X: p.X, Y: p.Y})
	}
	return &pb.ZoneConfig{
		Points:      points,
		MinPlateRel: meta.Zone.MinPlateRel,
		MaxPlateRel: meta.Zone.MaxPlateRel,
		MaxTilt:     meta.Zone.Tilt,
	}
}

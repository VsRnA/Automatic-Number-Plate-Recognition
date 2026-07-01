package app

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"gorm.io/gorm"

	"github.com/VsRnA/Automatic-Number-Plate-Recognition/infrastructure"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/infrastructure/database"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/config"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/integration/scud"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/handler"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/model"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/repository"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/worker"
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

	hlsManager := infrastructure.NewFFmpegManager(cfg.HLSDir)
	slog.Info("HLS manager initialized", "dir", cfg.HLSDir)

	repositories := repository.NewRepository(db)
	handlers := handler.NewHandler(*cfg, repositories, recognitionClient, hlsManager, db)

	srv := infrastructure.NewHttpServer(cfg.HTTPPort, handlers.InitRoutes())

	go func() {
		slog.Info("HTTP server listening", "port", cfg.HTTPPort)
		if err := srv.Run(); err != nil {
			slog.Error("Error running HTTP server", "error", err)
			os.Exit(1)
		}
	}()

	workerCtx, workerCancel := context.WithCancel(context.Background())
	scudClient := scud.NewClient(cfg.ScudURL, cfg.ScudStubURL)
	recognitionWorker := worker.NewRecognitionWorker(
		repositories.Plate,
		repositories.PlateAccessPoint,
		repositories.Camera,
		repositories.AccessPoint,
		repositories.Recognition,
		scudClient,
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
		go restoreWorkers(recognitionClient, repositories.Camera, hlsManager)
		go workerHealthChecker(workerCtx, recognitionClient, repositories.Camera, hlsManager)
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

	hlsManager.StopAll()

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

func workerHealthChecker(ctx context.Context, client *infrastructure.RecognitionClient, cameraRepo repository.ICameraRepository, hls *infrastructure.FFmpegManager) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			isEnabled := true
			cameras, err := cameraRepo.List(&repository.CameraFilters{IsEnabled: &isEnabled, Limit: 1000})
			if err != nil {
				slog.Error("WorkerHealthChecker: failed to list cameras", "error", err)
				continue
			}
			var wg sync.WaitGroup
			for _, cam := range cameras {
				wg.Add(1)
				go func(cam model.Camera) {
					defer wg.Done()
					statusCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
					statusResp, statusErr := client.GetWorkerStatus(statusCtx, cam.Guid.String())
					cancel()
					if statusErr != nil || statusResp.Status != "running" {
						startCtx, startCancel := context.WithTimeout(ctx, 5*time.Second)
						zone := handler.ExtractZoneConfig(cam.Metadata)
						startResp, startErr := client.StartWorker(startCtx, cam.Guid.String(), cam.StreamHd, zone)
						startCancel()
						if startErr != nil || !startResp.Success {
							slog.Warn("WorkerHealthChecker: failed to start worker", "camera_id", cam.Guid, "error", startErr)
						} else {
							slog.Info("WorkerHealthChecker: started worker", "camera_id", cam.Guid)
							if hls != nil {
								if hlsErr := hls.Start(cam.Guid.String(), cam.Stream); hlsErr != nil {
									slog.Warn("WorkerHealthChecker: failed to start HLS", "camera_id", cam.Guid, "error", hlsErr)
								}
							}
						}
					}
				}(cam)
			}
			wg.Wait()
		}
	}
}

func restoreWorkers(client *infrastructure.RecognitionClient, cameraRepo repository.ICameraRepository, hls *infrastructure.FFmpegManager) {
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
		zone := handler.ExtractZoneConfig(cam.Metadata)
		resp, err := client.StartWorker(ctx, cam.Guid.String(), cam.StreamHd, zone)
		cancel()
		if err != nil || !resp.Success {
			slog.Warn("Failed to start worker for camera on startup", "camera_id", cam.Guid, "error", err)
		} else {
			slog.Info("Started worker for camera on startup", "camera_id", cam.Guid)
			if hls != nil {
				if hlsErr := hls.Start(cam.Guid.String(), cam.Stream); hlsErr != nil {
					slog.Warn("Failed to start HLS for camera on startup", "camera_id", cam.Guid, "error", hlsErr)
				}
			}
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



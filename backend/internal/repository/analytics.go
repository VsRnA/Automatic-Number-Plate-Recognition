package repository

import (
	"fmt"

	"gorm.io/gorm"

	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/model"
)

type IAnalyticsRepository interface {
	GetDashboard() (*model.DashboardResponse, error)
}

type AnalyticsRepository struct {
	db *gorm.DB
}

func NewAnalyticsRepository(db *gorm.DB) IAnalyticsRepository {
	return &AnalyticsRepository{db: db}
}

func (r *AnalyticsRepository) GetDashboard() (*model.DashboardResponse, error) {
	sqlDB, err := r.db.DB()
	if err != nil {
		return nil, fmt.Errorf("get sql db: %w", err)
	}

	var summary model.AnalyticsSummary
	row := sqlDB.QueryRow(`
		SELECT
			COUNT(*) AS total,
			COUNT(*) FILTER (WHERE "occurredAt" >= NOW() - INTERVAL '1 day')  AS today,
			COUNT(*) FILTER (WHERE "occurredAt" >= NOW() - INTERVAL '7 days') AS this_week,
			COUNT(*) FILTER (WHERE "occurredAt" >= NOW() - INTERVAL '30 days') AS this_month,
			COUNT(DISTINCT "plateNumber") AS unique_plates,
			COUNT(*) FILTER (WHERE "accessGranted" = true)  AS granted,
			COUNT(*) FILTER (WHERE "accessGranted" = false) AS denied
		FROM "recognitionHistory"
	`)
	if err := row.Scan(
		&summary.Total, &summary.Today, &summary.ThisWeek, &summary.ThisMonth,
		&summary.UniquePlates, &summary.Granted, &summary.Denied,
	); err != nil {
		return nil, fmt.Errorf("summary scan: %w", err)
	}

	timelineRows, err := sqlDB.Query(`
		SELECT
			TO_CHAR(DATE("occurredAt"), 'YYYY-MM-DD') AS day,
			COUNT(*) AS count
		FROM "recognitionHistory"
		WHERE "occurredAt" >= NOW() - INTERVAL '30 days'
		GROUP BY DATE("occurredAt")
		ORDER BY day ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("timeline query: %w", err)
	}
	defer timelineRows.Close()

	timeline := make([]model.TimelinePoint, 0)
	for timelineRows.Next() {
		var p model.TimelinePoint
		if err := timelineRows.Scan(&p.Day, &p.Count); err != nil {
			return nil, fmt.Errorf("timeline row scan: %w", err)
		}
		timeline = append(timeline, p)
	}

	cameraRows, err := sqlDB.Query(`
		SELECT
			rh."cameraGuid"::text,
			COALESCE(c.name, 'Неизвестная камера') AS camera_name,
			COUNT(*) AS count
		FROM "recognitionHistory" rh
		LEFT JOIN cameras c ON c.guid = rh."cameraGuid" AND c."deletedAt" IS NULL
		GROUP BY rh."cameraGuid", c.name
		ORDER BY count DESC
		LIMIT 10
	`)
	if err != nil {
		return nil, fmt.Errorf("camera query: %w", err)
	}
	defer cameraRows.Close()

	byCamera := make([]model.CameraStats, 0)
	for cameraRows.Next() {
		var cs model.CameraStats
		if err := cameraRows.Scan(&cs.CameraId, &cs.CameraName, &cs.Count); err != nil {
			return nil, fmt.Errorf("camera row scan: %w", err)
		}
		byCamera = append(byCamera, cs)
	}

	plateRows, err := sqlDB.Query(`
		SELECT
			"plateNumber",
			COUNT(*) AS count,
			MAX("occurredAt") AS last_seen,
			COUNT(*) FILTER (WHERE "accessGranted" = true) AS granted_count
		FROM "recognitionHistory"
		GROUP BY "plateNumber"
		ORDER BY count DESC
		LIMIT 10
	`)
	if err != nil {
		return nil, fmt.Errorf("top plates query: %w", err)
	}
	defer plateRows.Close()

	topPlates := make([]model.TopPlate, 0)
	for plateRows.Next() {
		var tp model.TopPlate
		if err := plateRows.Scan(&tp.PlateNumber, &tp.Count, &tp.LastSeen, &tp.GrantedCount); err != nil {
			return nil, fmt.Errorf("top plate row scan: %w", err)
		}
		topPlates = append(topPlates, tp)
	}

	return &model.DashboardResponse{
		Summary:   summary,
		Timeline:  timeline,
		ByCamera:  byCamera,
		TopPlates: topPlates,
	}, nil
}

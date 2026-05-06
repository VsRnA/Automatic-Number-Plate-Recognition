package model

import "time"

type AnalyticsSummary struct {
	Total        int64 `json:"total"`
	Today        int64 `json:"today"`
	ThisWeek     int64 `json:"thisWeek"`
	ThisMonth    int64 `json:"thisMonth"`
	UniquePlates int64 `json:"uniquePlates"`
	Granted      int64 `json:"granted"`
	Denied       int64 `json:"denied"`
}

type TimelinePoint struct {
	Day   string `json:"day"`
	Count int64  `json:"count"`
}

type CameraStats struct {
	CameraId   string `json:"cameraId"`
	CameraName string `json:"cameraName"`
	Count      int64  `json:"count"`
}

type TopPlate struct {
	PlateNumber  string    `json:"plateNumber"`
	Count        int64     `json:"count"`
	LastSeen     time.Time `json:"lastSeen"`
	GrantedCount int64     `json:"grantedCount"`
}

type DashboardResponse struct {
	Summary   AnalyticsSummary `json:"summary"`
	Timeline  []TimelinePoint  `json:"timeline"`
	ByCamera  []CameraStats    `json:"byCamera"`
	TopPlates []TopPlate       `json:"topPlates"`
}

package model

import "github.com/google/uuid"

type PlateAccessPoint struct {
	PlateGuid     uuid.UUID `gorm:"column:plate_guid;type:uuid;primaryKey"`
	AccessPointId int       `gorm:"column:access_point_id;primaryKey"`
}

func (PlateAccessPoint) TableName() string {
	return "plateAccessPoints"
}

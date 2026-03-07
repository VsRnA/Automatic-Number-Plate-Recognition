package model

import "time"

type AccessPoint struct {
	ID          int       `json:"id" gorm:"column:id;primaryKey;autoIncrement"`
	Name        string    `json:"name" gorm:"column:name;size:100;not null;uniqueIndex"`
	Description string    `json:"description" gorm:"column:description;size:500"`
	IsEnabled   bool      `json:"isEnabled" gorm:"column:isEnabled;default:true"`
	CreatedAt   time.Time `json:"createdAt" gorm:"column:createdAt"`
}

func (AccessPoint) TableName() string {
	return "accessPoints"
}

type CreateAccessPointRequest struct {
	Name        string `json:"name" validate:"required,min=1,max=100"`
	Description string `json:"description" validate:"max=500"`
	IsEnabled   *bool  `json:"isEnabled"`
}

type UpdateAccessPointRequest struct {
	Name        string `json:"name" validate:"omitempty,min=1,max=100"`
	Description string `json:"description" validate:"max=500"`
	IsEnabled   *bool  `json:"isEnabled"`
}

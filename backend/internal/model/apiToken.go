package model

import (
	"time"

	"github.com/google/uuid"
)

type ApiToken struct {
	ID          uuid.UUID  `json:"id" gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()"`
	Token       string     `json:"-" gorm:"column:token;size:255;not null;uniqueIndex"`
	TokenPrefix string     `json:"tokenPrefix" gorm:"column:tokenPrefix;size:16;not null"`
	Description string     `json:"description" gorm:"column:description;size:255"`
	IsActive    bool       `json:"isActive" gorm:"column:isActive;default:true"`
	LastUsedAt  *time.Time `json:"lastUsedAt" gorm:"column:lastUsedAt"`
	CreatedAt   time.Time  `json:"createdAt" gorm:"column:createdAt"`
}

func (ApiToken) TableName() string {
	return "api_tokens"
}

type CreateApiTokenRequest struct {
	Description string `json:"description" validate:"max=255"`
}

type ApiTokenResponse struct {
	ID          uuid.UUID  `json:"id"`
	TokenPrefix string     `json:"tokenPrefix"`
	Description string     `json:"description"`
	IsActive    bool       `json:"isActive"`
	LastUsedAt  *time.Time `json:"lastUsedAt"`
	CreatedAt   time.Time  `json:"createdAt"`
}

type CreateApiTokenResponse struct {
	ID          uuid.UUID `json:"id"`
	Token       string    `json:"token"` // returned only once on creation
	TokenPrefix string    `json:"tokenPrefix"`
	Description string    `json:"description"`
	IsActive    bool      `json:"isActive"`
	CreatedAt   time.Time `json:"createdAt"`
}

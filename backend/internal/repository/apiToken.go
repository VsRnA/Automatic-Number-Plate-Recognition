package repository

import (
	"crypto/sha256"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/model"
)

type IApiTokenRepository interface {
	Create(token *model.ApiToken) error
	FindByTokenHash(tokenHash string) (*model.ApiToken, error)
	List() ([]model.ApiToken, error)
	Delete(id uuid.UUID) error
	UpdateLastUsed(id uuid.UUID, t time.Time) error
}

type ApiTokenRepository struct {
	db *gorm.DB
}

func NewApiTokenRepository(db *gorm.DB) IApiTokenRepository {
	return &ApiTokenRepository{db: db}
}

func HashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return fmt.Sprintf("%x", h)
}

func (r *ApiTokenRepository) Create(token *model.ApiToken) error {
	return r.db.Create(token).Error
}

func (r *ApiTokenRepository) FindByTokenHash(tokenHash string) (*model.ApiToken, error) {
	var token model.ApiToken
	result := r.db.Where(`"token" = ? AND "isActive" = TRUE`, tokenHash).First(&token)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, result.Error
	}
	return &token, nil
}

func (r *ApiTokenRepository) List() ([]model.ApiToken, error) {
	var tokens []model.ApiToken
	if err := r.db.Order(`"createdAt" DESC`).Find(&tokens).Error; err != nil {
		return nil, err
	}
	return tokens, nil
}

func (r *ApiTokenRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&model.ApiToken{}, "id = ?", id).Error
}

func (r *ApiTokenRepository) UpdateLastUsed(id uuid.UUID, t time.Time) error {
	return r.db.Model(&model.ApiToken{}).Where("id = ?", id).Update("lastUsedAt", t).Error
}

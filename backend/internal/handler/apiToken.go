package handler

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"

	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/exception"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/model"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/repository"
)

type IApiTokenHandler interface {
	CreateToken(c *gin.Context)
	ListTokens(c *gin.Context)
	DeleteToken(c *gin.Context)
}

type ApiTokenHandler struct {
	repo     repository.IApiTokenRepository
	validate *validator.Validate
}

func NewApiTokenHandler(repo repository.IApiTokenRepository, validate *validator.Validate) IApiTokenHandler {
	return &ApiTokenHandler{repo: repo, validate: validate}
}

func (h *ApiTokenHandler) CreateToken(c *gin.Context) {
	var req model.CreateApiTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		exception.HttpResponseException(c, exception.RequestValidationError(err.Error()))
		return
	}
	if err := h.validate.Struct(req); err != nil {
		exception.HttpResponseException(c, exception.RequestValidationError(err.Error()))
		return
	}

	rawBytes := make([]byte, 32)
	if _, err := rand.Read(rawBytes); err != nil {
		exception.HttpResponseException(c, exception.InternalError("failed to generate token"))
		return
	}
	rawToken := hex.EncodeToString(rawBytes)
	tokenHash := fmt.Sprintf("%x", sha256.Sum256([]byte(rawToken)))

	token := &model.ApiToken{
		Token:       tokenHash,
		TokenPrefix: rawToken[:8],
		Description: req.Description,
		IsActive:    true,
	}

	if err := h.repo.Create(token); err != nil {
		exception.HttpResponseException(c, exception.InternalError("failed to create token"))
		return
	}

	c.JSON(http.StatusCreated, model.CreateApiTokenResponse{
		ID:          token.ID,
		Token:       rawToken,
		TokenPrefix: token.TokenPrefix,
		Description: token.Description,
		IsActive:    token.IsActive,
		CreatedAt:   token.CreatedAt,
	})
}

func (h *ApiTokenHandler) ListTokens(c *gin.Context) {
	tokens, err := h.repo.List()
	if err != nil {
		exception.HttpResponseException(c, exception.InternalError("failed to list tokens"))
		return
	}

	result := make([]model.ApiTokenResponse, len(tokens))
	for i, t := range tokens {
		result[i] = model.ApiTokenResponse{
			ID:          t.ID,
			TokenPrefix: t.TokenPrefix,
			Description: t.Description,
			IsActive:    t.IsActive,
			LastUsedAt:  t.LastUsedAt,
			CreatedAt:   t.CreatedAt,
		}
	}

	c.JSON(http.StatusOK, result)
}

func (h *ApiTokenHandler) DeleteToken(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		exception.HttpResponseException(c, exception.RequestValidationError("invalid uuid format"))
		return
	}

	if err := h.repo.Delete(id); err != nil {
		exception.HttpResponseException(c, exception.InternalError("failed to delete token"))
		return
	}

	c.Status(http.StatusNoContent)
}

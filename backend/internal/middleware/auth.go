package middleware

import (
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/config"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/exception"
	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/repository"
)

func Auth(cfg config.Config, tokenRepo repository.IApiTokenRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")

		if authHeader == "" {
			c.Header("WWW-Authenticate", `Basic realm="ANPR"`)
			exception.HttpResponseException(c, exception.AuthError("authorization required"))
			c.Abort()
			return
		}

		if strings.HasPrefix(authHeader, "Basic ") {
			payload, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(authHeader, "Basic "))
			if err != nil {
				c.Header("WWW-Authenticate", `Basic realm="ANPR"`)
				exception.HttpResponseException(c, exception.AuthError("invalid authorization header"))
				c.Abort()
				return
			}

			parts := strings.SplitN(string(payload), ":", 2)
			if len(parts) != 2 || parts[0] != cfg.AdminUser || parts[1] != cfg.AdminPassword {
				c.Header("WWW-Authenticate", `Basic realm="ANPR"`)
				exception.HttpResponseException(c, exception.AuthError("invalid credentials"))
				c.Abort()
				return
			}

			c.Next()
			return
		}

		if strings.HasPrefix(authHeader, "Bearer ") {
			rawToken := strings.TrimPrefix(authHeader, "Bearer ")
			tokenHash := fmt.Sprintf("%x", sha256.Sum256([]byte(rawToken)))

			token, err := tokenRepo.FindByTokenHash(tokenHash)
			if err != nil {
				exception.HttpResponseException(c, exception.InternalError("failed to validate token"))
				c.Abort()
				return
			}
			if token == nil {
				exception.HttpResponseException(c, exception.AuthError("invalid or inactive token"))
				c.Abort()
				return
			}

			go func(id uuid.UUID) {
				if err := tokenRepo.UpdateLastUsed(id, time.Now()); err != nil {
					log.Printf("auth: failed to update last_used for token %v: %v", id, err)
				}
			}(token.ID)

			c.Next()
			return
		}

		c.Header("WWW-Authenticate", `Basic realm="ANPR"`)
		exception.HttpResponseException(c, exception.AuthError("unsupported authorization method"))
		c.Abort()
	}
}

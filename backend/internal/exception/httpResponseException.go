package exception

import (
	"log/slog"

	"github.com/gin-gonic/gin"
)

func HttpResponseException(c *gin.Context, apiError *ApiError) {
	slog.Warn("HTTP error response", "guid", apiError.Guid, "code", apiError.Code, "message", apiError.Message, "status", apiError.Status)
	c.AbortWithStatusJSON(apiError.Status, gin.H{"error": apiError})
}

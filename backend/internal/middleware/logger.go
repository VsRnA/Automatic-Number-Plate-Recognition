package middleware

import (
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
)

func StructuredLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.FullPath()
		if path == "" {
			path = c.Request.URL.Path
		}

		c.Next()

		status := c.Writer.Status()
		latencyMs := time.Since(start).Milliseconds()

		attrs := []any{
			"method", c.Request.Method,
			"path", path,
			"status", status,
			"latency_ms", latencyMs,
			"client_ip", c.ClientIP(),
		}

		switch {
		case status >= 500:
			slog.Error("HTTP request", attrs...)
		case status >= 400:
			slog.Warn("HTTP request", attrs...)
		default:
			slog.Info("HTTP request", attrs...)
		}
	}
}

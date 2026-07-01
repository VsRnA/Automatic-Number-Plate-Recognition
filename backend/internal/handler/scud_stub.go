package handler

import (
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// ScudStub принимает прокси-запрос от integration/scud.Client.
// Реальный целевой URL передаётся в заголовке X-Scud-Target-Url (CommonHttpRequest.url).
func ScudStub(c *gin.Context) {
	targetURL := c.GetHeader("X-Scud-Target-Url")
	body, _ := io.ReadAll(io.LimitReader(c.Request.Body, 64*1024))

	slog.Info("CommonHttpRequest stub",
		"target_url", targetURL,
		"method", c.Request.Method,
		"body_len", len(body),
	)

	c.JSON(http.StatusOK, gin.H{
		"ok":        true,
		"message":   "Заглушка: запрос принят. В продакшене здесь будет вызов целевого URL.",
		"targetUrl": targetURL,
		"method":    c.Request.Method,
		"received":  string(body),
		"stubRoute": "/internal/common-http-request",
		"handledAt": time.Now().UTC().Format(time.RFC3339),
	})
}

package handler

import (
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
)

func ScudStub(c *gin.Context) {
	targetURL := c.GetHeader("X-Scud-Target-Url")
	body, _ := io.ReadAll(io.LimitReader(c.Request.Body, 64*1024))

	c.JSON(http.StatusOK, gin.H{
		"ok":        true,
		"targetUrl": targetURL,
		"received":  string(body),
	})
}

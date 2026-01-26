package app

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

func Run() {
	router := gin.Default()

	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	router.GET("/api/plates", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"plates": []string{"A123BC", "X456YZ", "M789NX"},
		})
	})

	router.POST("/api/recognize", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"plate":      "A123BC",
			"confidence": 0.95,
		})
	})

	log.Println("Starting server on :8080")
	if err := router.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

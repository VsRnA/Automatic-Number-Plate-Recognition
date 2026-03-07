package main

import (
	"log"

	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/app"
)

func main() {
	application := app.New()
	if err := application.Run(); err != nil {
		log.Fatalf("Application error: %v", err)
	}
}

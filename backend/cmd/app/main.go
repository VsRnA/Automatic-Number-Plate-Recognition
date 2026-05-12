package main

import (
	"log/slog"
	"os"

	"github.com/VsRnA/Automatic-Number-Plate-Recognition/internal/app"
)

func main() {
	application := app.New()
	if err := application.Run(); err != nil {
		slog.Error("Application error", "error", err)
		os.Exit(1)
	}
}

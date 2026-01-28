package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Env      string `env:"ENV"`
	HTTPPort string `env:"HTTP_PORT"`
	DBHost   string `env:"DB_HOST"`
	DBPort   string `env:"DB_PORT"`
	DBName   string `env:"DB_NAME"`
	DBUser   string `env:"DB_USER"`
	DBPass   string `env:"DB_PASS"`
	DBSsl    string `env:"DB_SSL"`
}

func LoadEnv() (*Config, error) {
	_ = godotenv.Load()

	cfg := &Config{
		Env:      getEnv("ENV", "development"),
		HTTPPort: getEnv("HTTP_PORT", "8080"),
		DBHost:   getEnv("DB_HOST", "localhost"),
		DBPort:   getEnv("DB_PORT", "5432"),
		DBName:   getEnv("DB_NAME", "anpr"),
		DBUser:   getEnv("DB_USER", "anrpPostgres"),
		DBPass:   getEnv("DB_PASS", "anrpPostgres"),
		DBSsl:    getEnv("DB_SSL", "disable"),
	}

	if err := cfg.ValidateRequired(); err != nil {
		return nil, err
	}

	return cfg, nil
}

func (c *Config) ValidateRequired() error {
	required := map[string]string{
		"DB_HOST": c.DBHost,
		"DB_USER": c.DBUser,
		"DB_PASS": c.DBPass,
	}

	for key, value := range required {
		if value == "" {
			return fmt.Errorf("environment variable %s is required", key)
		}
	}

	return nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	strValue := os.Getenv(key)
	if strValue == "" {
		return defaultValue
	}
	value, err := strconv.Atoi(strValue)
	if err != nil {
		return defaultValue
	}
	return value
}

func getEnvBool(key string, defaultValue bool) bool {
	strValue := os.Getenv(key)
	if strValue == "" {
		return defaultValue
	}
	switch strings.ToLower(strValue) {
	case "true", "1":
		return true
	case "false", "0":
		return false
	default:
		return defaultValue
	}
}

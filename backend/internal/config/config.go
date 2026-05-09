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
	LogLevel string `env:"LOG_LEVEL"`
	HTTPPort string `env:"HTTP_PORT"`

	AdminUser     string `env:"ADMIN_USER"`
	AdminPassword string `env:"ADMIN_PASSWORD"`

	DBHost string `env:"DB_HOST"`
	DBPort string `env:"DB_PORT"`
	DBName string `env:"DB_NAME"`
	DBUser string `env:"DB_USER"`
	DBPass string `env:"DB_PASS"`
	DBSsl  string `env:"DB_SSL"`

	RedisHost   string `env:"REDIS_HOST"`
	RedisPort   string `env:"REDIS_PORT"`
	RedisStream string `env:"REDIS_STREAM"`

	GRPCHost string `env:"GRPC_HOST"`
	GRPCPort string `env:"GRPC_PORT"`

	HLSDir string `env:"HLS_DIR"`

	S3Endpoint  string `env:"S3_ENDPOINT"`
	S3AccessKey string `env:"S3_ACCESS_KEY"`
	S3SecretKey string `env:"S3_SECRET_KEY"`
	S3Bucket    string `env:"S3_BUCKET"`
	S3UseSSL    bool   `env:"S3_USE_SSL"`
	S3Region    string `env:"S3_REGION"`
}

func LoadEnv() (*Config, error) {
	_ = godotenv.Load()

	cfg := &Config{
		Env:      getEnv("ENV", "development"),
		LogLevel: getEnv("LOG_LEVEL", "info"),
		HTTPPort: getEnv("HTTP_PORT", "8080"),

		AdminUser:     getEnv("ADMIN_USER", "admin"),
		AdminPassword: getEnv("ADMIN_PASSWORD", "admin"),

		DBHost: getEnv("DB_HOST", "localhost"),
		DBPort: getEnv("DB_PORT", "5432"),
		DBName: getEnv("DB_NAME", "anpr"),
		DBUser: getEnv("DB_USER", "anrpPostgres"),
		DBPass: getEnv("DB_PASS", "anrpPostgres"),
		DBSsl:  getEnv("DB_SSL", "disable"),

		RedisHost:   getEnv("REDIS_HOST", "localhost"),
		RedisPort:   getEnv("REDIS_PORT", "6379"),
		RedisStream: getEnv("REDIS_STREAM", "anpr:results"),

		GRPCHost: getEnv("GRPC_HOST", "localhost"),
		GRPCPort: getEnv("GRPC_PORT", "50051"),

		HLSDir: getEnv("HLS_DIR", "/tmp/hls"),

		S3Endpoint:  getEnv("S3_ENDPOINT", ""),
		S3AccessKey: getEnv("S3_ACCESS_KEY", ""),
		S3SecretKey: getEnv("S3_SECRET_KEY", ""),
		S3Bucket:    getEnv("S3_BUCKET", "anpr"),
		S3UseSSL:    getEnvBool("S3_USE_SSL", false),
		S3Region:    getEnv("S3_REGION", "us-east-1"),
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

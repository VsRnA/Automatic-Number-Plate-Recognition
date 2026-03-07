package infrastructure

import (
	"fmt"

	"github.com/redis/go-redis/v9"
)

func NewRedisClient(host, port string) *redis.Client {
	return redis.NewClient(&redis.Options{
		Addr: fmt.Sprintf("%s:%s", host, port),
	})
}

package database

import (
	"context"
	"fmt"
	"log"

	"github.com/gonext/accounting-ecommerce/internal/config"
	"github.com/redis/go-redis/v9"
)

var Redis *redis.Client

func ConnectRedis(cfg *config.RedisConfig) *redis.Client {
	client := redis.NewClient(&redis.Options{
		Addr:     cfg.Host + ":" + cfg.Port,
		Password: cfg.Password,
		DB:       cfg.DB,
	})

	ctx := context.Background()
	if err := client.Ping(ctx).Err(); err != nil {
		log.Printf("Warning: Redis connection failed: %v (continuing without Redis)", err)
		return client
	}

	Redis = client
	fmt.Println("✓ Redis connected")
	return client
}

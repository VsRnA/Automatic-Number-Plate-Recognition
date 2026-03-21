package infrastructure

import (
	"context"
	"log"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

type MessageHandler interface {
	Handle(ctx context.Context, data []byte) error
}

type RedisConsumer struct {
	client       *redis.Client
	streamKey    string
	groupName    string
	consumerName string
	handler      MessageHandler
}

func NewRedisConsumer(
	client *redis.Client,
	streamKey, groupName, consumerName string,
	handler MessageHandler,
) *RedisConsumer {
	return &RedisConsumer{
		client:       client,
		streamKey:    streamKey,
		groupName:    groupName,
		consumerName: consumerName,
		handler:      handler,
	}
}

func (c *RedisConsumer) Start(ctx context.Context) {
	if err := c.ensureGroup(ctx); err != nil {
		log.Printf("RedisConsumer: failed to create group %q: %v", c.groupName, err)
		return
	}
	log.Printf("RedisConsumer: listening on stream=%s group=%s", c.streamKey, c.groupName)

	for {
		select {
		case <-ctx.Done():
			log.Printf("RedisConsumer: stopped (stream=%s)", c.streamKey)
			return
		default:
			c.poll(ctx)
		}
	}
}

func (c *RedisConsumer) ensureGroup(ctx context.Context) error {
	err := c.client.XGroupCreateMkStream(ctx, c.streamKey, c.groupName, "0").Err()
	if err != nil && !strings.Contains(err.Error(), "BUSYGROUP") {
		return err
	}
	return nil
}

func (c *RedisConsumer) poll(ctx context.Context) {
	entries, err := c.client.XReadGroup(ctx, &redis.XReadGroupArgs{
		Group:    c.groupName,
		Consumer: c.consumerName,
		Streams:  []string{c.streamKey, ">"},
		Count:    10,
		Block:    2 * time.Second,
	}).Result()

	if err != nil {
		if err != redis.Nil {
			log.Printf("RedisConsumer: XReadGroup error: %v", err)
		}
		return
	}

	for _, stream := range entries {
		for _, msg := range stream.Messages {
			data, ok := c.extractData(msg)
			if !ok {
				c.ack(ctx, msg.ID)
				continue
			}

			if err := c.handler.Handle(ctx, data); err != nil {
				log.Printf("RedisConsumer: handler error for message %s: %v", msg.ID, err)
			}
			c.ack(ctx, msg.ID)
		}
	}
}

func (c *RedisConsumer) extractData(msg redis.XMessage) ([]byte, bool) {
	raw, ok := msg.Values["data"]
	if !ok {
		return nil, false
	}
	switch v := raw.(type) {
	case string:
		return []byte(v), true
	case []byte:
		return v, true
	default:
		return nil, false
	}
}

func (c *RedisConsumer) ack(ctx context.Context, msgID string) {
	if err := c.client.XAck(ctx, c.streamKey, c.groupName, msgID).Err(); err != nil {
		log.Printf("RedisConsumer: failed to ACK message %s: %v", msgID, err)
	}
}

package db

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

var Pool *pgxpool.Pool

func Connect() error {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		return fmt.Errorf("DATABASE_URL not set")
	}

	pool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		return fmt.Errorf("unable to create connection pool: %w", err)
	}
	// Fail Fast at startup if the db isn't reachable
	if err := pool.Ping(context.Background()); err != nil {
		return fmt.Errorf("unable to reach database: %w", err)
	}

	Pool = pool
	return nil
}

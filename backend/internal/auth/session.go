package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"time"

	"golf-maintenance/backend/internal/db"
)

const sessionDuration = 7 * 24 * time.Hour

func generateToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

func CreateSession(ctx context.Context, userID string) (string, time.Time, error) {
	token, err := generateToken()
	if err != nil {
		return "", time.Time{}, err
	}

	expiresAt := time.Now().Add(sessionDuration)

	_, err = db.Pool.Exec(
		ctx,
		`INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)`,
		token, userID, expiresAt,
	)
	if err != nil {
		return "", time.Time{}, err
	}

	return token, expiresAt, nil
}

func GetUserIDFromToken(ctx context.Context, token string) (string, error) {
	var userID string
	err := db.Pool.QueryRow(
		ctx,
		`SELECT user_id FROM sessions WHERE token = $1 AND expires_at > now()`,
		token,
	).Scan(&userID)
	return userID, err
}

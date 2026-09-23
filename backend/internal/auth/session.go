package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/http"
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

type contextKey string

const userIDKey contextKey = "userID"

func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("session_token")
		if err != nil {
			http.Error(w, "not authenticated", http.StatusUnauthorized)
			return
		}

		userID, err := GetUserIDFromToken(r.Context(), cookie.Value)
		if err != nil {
			http.Error(w, "invalid or expired session", http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), userIDKey, userID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func UserIDFromContext(ctx context.Context) (string, bool) {
	userID, ok := ctx.Value(userIDKey).(string)
	return userID, ok
}

func RequireRole(role string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID, ok := UserIDFromContext(r.Context())
			if !ok {
				http.Error(w, "not authenticated", http.StatusUnauthorized)
				return
			}

			var userRole string
			err := db.Pool.QueryRow(
				r.Context(),
				`SELECT role FROM users WHERE id = $1`,
				userID,
			).Scan(&userRole)

			if err != nil {
				http.Error(w, "internal server error", http.StatusInternalServerError)
				return
			}

			if userRole != role {
				http.Error(w, "forbidden: insufficient permissions", http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

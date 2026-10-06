package testutil

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"

	"golf-maintenance/backend/internal/db"
)

// Tests run with the working directory set to the package being tested, so we walk upward until we find backend/.env.
func loadEnv() {
	directory, err := os.Getwd()
	if err != nil {
		return
	}
	for attempt := 0; attempt < 6; attempt++ {
		envPath := filepath.Join(directory, ".env")
		if _, err := os.Stat(envPath); err == nil {
			_ = godotenv.Load(envPath)
			return
		}
		directory = filepath.Dir(directory)
	}
}

// SetupTestDB connects db.Pool to the test database and wipes all data.
func SetupTestDB(t *testing.T) {
	t.Helper()
	loadEnv()

	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Fatal("TEST_DATABASE_URL is not set")
	}

	parsedURL, err := url.Parse(databaseURL)
	if err != nil {
		t.Fatalf("invalid TEST_DATABASE_URL: %v", err)
	}
	databaseName := strings.TrimPrefix(parsedURL.Path, "/")
	if !strings.HasSuffix(databaseName, "_test") {
		t.Fatalf("refusing to run: database %q does not end in _test", databaseName)
	}

	pool, err := pgxpool.New(context.Background(), databaseURL)
	if err != nil {
		t.Fatalf("could not create pool: %v", err)
	}
	t.Cleanup(pool.Close)

	if err := pool.Ping(context.Background()); err != nil {
		t.Fatalf("could not reach test database: %v", err)
	}

	_, err = pool.Exec(
		context.Background(),
		`TRUNCATE TABLE schedules, equipment, amenities, holes, sessions, clock_entries, courses, users CASCADE`,
	)
	if err != nil {
		t.Fatalf("could not clean test database: %v", err)
	}

	db.Pool = pool
}

// CreateUser inserts a user directly and returns their ID.
func CreateUser(t *testing.T, email, password, role string) string {
	t.Helper()

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("could not hash password: %v", err)
	}

	var userID string
	err = db.Pool.QueryRow(
		context.Background(),
		`INSERT INTO users (email, password_hash, full_name, role)
		 VALUES ($1, $2, $3, $4) RETURNING id`,
		email, string(passwordHash), "Test "+role, role,
	).Scan(&userID)
	if err != nil {
		t.Fatalf("could not create user: %v", err)
	}
	return userID
}

// SessionCookie creates a session for the user and returns the cookie a logged-n browser would send
func SessionCookie(t *testing.T, userID string) *http.Cookie {
	t.Helper()

	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		t.Fatalf("could not generate token: %v", err)
	}
	token := hex.EncodeToString(tokenBytes)

	_, err := db.Pool.Exec(
		context.Background(),
		`INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)`,
		token, userID, time.Now().Add(time.Hour),
	)
	if err != nil {
		t.Fatalf("could not create session: %v", err)
	}
	return &http.Cookie{Name: "session_token", Value: token}
}

package handlers

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"golf-maintenance/backend/internal/db"
)

// openClockInTime is when the person clocked in, or nil when they are not on the clock.
// Someone is on the clock when they have a clock entry with no clock-out. If a glitch ever
// left more than one open, the earliest counts.
func openClockInTime(ctx context.Context, userID string) (*time.Time, error) {
	var clockedInAt time.Time
	err := db.Pool.QueryRow(
		ctx,
		`SELECT clock_in FROM clock_entries
		 WHERE user_id = $1 AND clock_out IS NULL
		 ORDER BY clock_in
		 LIMIT 1`,
		userID,
	).Scan(&clockedInAt)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &clockedInAt, nil
}

package handlers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"golf-maintenance/backend/internal/db"
	"golf-maintenance/backend/internal/models"
)

const maxScheduleRangeDays = 62

// dateRange is an optional run of days, both ends included, as YYYY-MM-DD text. Both ends
// are nil when no range was asked for.
type dateRange struct {
	start *string
	end   *string
}

// scheduleRangeFromQuery reads the optional start and end query parameters that every
// schedule endpoint shares. The second value is a message for a 400 response, and is empty
// when the range is acceptable.
func scheduleRangeFromQuery(r *http.Request) (dateRange, string) {
	startParam := r.URL.Query().Get("start")
	endParam := r.URL.Query().Get("end")

	if startParam == "" && endParam == "" {
		return dateRange{}, ""
	}
	if startParam == "" || endParam == "" {
		return dateRange{}, "start and end must be provided together"
	}

	parsedStart, err := time.Parse("2006-01-02", startParam)
	if err != nil {
		return dateRange{}, "invalid start date"
	}
	parsedEnd, err := time.Parse("2006-01-02", endParam)
	if err != nil {
		return dateRange{}, "invalid end date"
	}
	if parsedEnd.Before(parsedStart) {
		return dateRange{}, "end must not be before start"
	}
	if parsedEnd.Sub(parsedStart) > maxScheduleRangeDays*24*time.Hour {
		return dateRange{}, fmt.Sprintf("date range cannot exceed %d days", maxScheduleRangeDays)
	}

	return dateRange{start: &startParam, end: &endParam}, ""
}

// listSchedules returns shifts in date and start order, as an empty list rather than nil
// when there are none. A nil userID means everyone's shifts; otherwise only that person's.
func listSchedules(ctx context.Context, userID *string, shiftRange dateRange) ([]models.Schedule, error) {
	rows, err := db.Pool.Query(
		ctx,
		`SELECT s.id, s.user_id, u.full_name, s.shift_date::text, s.start_time::text, s.end_time::text
		 FROM schedules s
		 JOIN users u ON u.id = s.user_id
		 WHERE ($1::uuid IS NULL OR s.user_id = $1::uuid)
		   AND ($2::date IS NULL OR s.shift_date >= $2::date)
		   AND ($3::date IS NULL OR s.shift_date <= $3::date)
		 ORDER BY s.shift_date, s.start_time`,
		userID, shiftRange.start, shiftRange.end,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	schedules := []models.Schedule{}
	for rows.Next() {
		var schedule models.Schedule
		if err := rows.Scan(&schedule.ID, &schedule.UserID, &schedule.FullName, &schedule.ShiftDate, &schedule.StartTime, &schedule.EndTime); err != nil {
			return nil, err
		}
		schedules = append(schedules, schedule)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return schedules, nil
}

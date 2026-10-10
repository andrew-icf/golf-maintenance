package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"golf-maintenance/backend/internal/db"
	"golf-maintenance/backend/internal/models"
)

func GetSchedules(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	rows, err := db.Pool.Query(
		r.Context(),
		`SELECT s.id, s.user_id, u.full_name, s.shift_date::text, s.start_time::text, s.end_time::text
		FROM schedules s
		JOIN users u ON u.id = s.user_id
		ORDER BY s.shift_date, s.start_time`,
	)
	if err != nil {
		log.Printf("error fetching schedules: %v", err)
		http.Error(w, "could not fetch schedules", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	schedules := []models.Schedule{}
	for rows.Next() {
		var s models.Schedule
		if err := rows.Scan(&s.ID, &s.UserID, &s.FullName, &s.ShiftDate, &s.StartTime, &s.EndTime); err != nil {
			log.Printf("error scanning schedule: %v", err)
			http.Error(w, "could not fetch schedules", http.StatusInternalServerError)
			return
		}
		schedules = append(schedules, s)
	}

	json.NewEncoder(w).Encode(schedules)
}

type createScheduleRequest struct {
	UserID    string `json:"user_id"`
	ShiftDate string `json:"shift_date"`
	StartTime string `json:"start_time"`
	EndTime   string `json:"end_time"`
}

func CreateSchedule(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req createScheduleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.UserID == "" || req.ShiftDate == "" || req.StartTime == "" || req.EndTime == "" {
		http.Error(w, "user_id, shift_date, start_time, and end_time are required", http.StatusBadRequest)
		return
	}

	if req.EndTime <= req.StartTime {
		http.Error(w, "end_time must be after start_time", http.StatusBadRequest)
		return
	}

	var id string
	err := db.Pool.QueryRow(
		r.Context(),
		`INSERT INTO schedules (user_id, shift_date, start_time, end_time)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id`,
		req.UserID, req.ShiftDate, req.StartTime, req.EndTime,
	).Scan(&id)

	if err != nil {
		log.Printf("error creating schedule: %v", err)
		http.Error(w, "could not create schedule", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"id":      id,
		"message": "shift created",
	})
}

type repeatScheduleRequest struct {
	UserID    string   `json:"user_id"`
	StartDate string   `json:"start_date"`
	Weeks     int      `json:"weeks"`
	Days      []string `json:"days"`
	StartTime string   `json:"start_time"`
	EndTime   string   `json:"end_time"`
}

var weekdayByName = map[string]time.Weekday{
	"sunday":    time.Sunday,
	"monday":    time.Monday,
	"tuesday":   time.Tuesday,
	"wednesday": time.Wednesday,
	"thursday":  time.Thursday,
	"friday":    time.Friday,
	"saturday":  time.Saturday,
}

func RepeatSchedule(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req repeatScheduleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.UserID == "" || req.StartDate == "" || req.StartTime == "" || req.EndTime == "" || len(req.Days) == 0 {
		http.Error(w, "user_id, start_date, days, start_time, and end_time are required", http.StatusBadRequest)
		return
	}

	if req.EndTime <= req.StartTime {
		http.Error(w, "end_time must be after start_time", http.StatusBadRequest)
		return
	}

	if req.Weeks < 1 {
		req.Weeks = 1
	}

	startDate, err := time.Parse("2006-01-02", req.StartDate)
	if err != nil {
		http.Error(w, "invalid start_date", http.StatusBadRequest)
		return
	}

	selectedWeekdays := map[time.Weekday]bool{}
	for _, dayName := range req.Days {
		weekday, ok := weekdayByName[strings.ToLower(dayName)]
		if !ok {
			http.Error(w, fmt.Sprintf("invalid day: %s", dayName), http.StatusBadRequest)
			return
		}
		selectedWeekdays[weekday] = true
	}

	transaction, err := db.Pool.Begin(r.Context())
	if err != nil {
		log.Printf("error starting transaction: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	defer transaction.Rollback(r.Context())

	var createdDates []string
	var skippedDates []string
	totalDays := req.Weeks * 7

	for dayOffset := 0; dayOffset < totalDays; dayOffset++ {
		candidateDate := startDate.AddDate(0, 0, dayOffset)
		if !selectedWeekdays[candidateDate.Weekday()] {
			continue
		}

		dateString := candidateDate.Format("2006-01-02")

		var existingID string
		err := transaction.QueryRow(
			r.Context(),
			`SELECT id FROM schedules WHERE user_id = $1 AND shift_date = $2`,
			req.UserID, dateString,
		).Scan(&existingID)

		if err == nil {
			skippedDates = append(skippedDates, dateString)
			continue
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			log.Printf("error checking existing schedule: %v", err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}

		var newID string
		err = transaction.QueryRow(
			r.Context(),
			`INSERT INTO schedules (user_id, shift_date, start_time, end_time)
			 VALUES ($1, $2, $3, $4) RETURNING id`,
			req.UserID, dateString, req.StartTime, req.EndTime,
		).Scan(&newID)
		if err != nil {
			log.Printf("error creating schedule: %v", err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}
		createdDates = append(createdDates, dateString)
	}

	if err := transaction.Commit(r.Context()); err != nil {
		log.Printf("error committing transaction: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"created": createdDates,
		"skipped": skippedDates,
		"message": "shifts created",
	})
}

type updateScheduleRequest struct {
	ShiftDate string `json:"shift_date"`
	StartTime string `json:"start_time"`
	EndTime   string `json:"end_time"`
}

func UpdateSchedule(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	id := chi.URLParam(r, "id")

	var req updateScheduleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.ShiftDate == "" || req.StartTime == "" || req.EndTime == "" {
		http.Error(w, "shift_date, start_time, and end_time are required", http.StatusBadRequest)
		return
	}

	if req.EndTime <= req.StartTime {
		http.Error(w, "end_time must be after start_time", http.StatusBadRequest)
		return
	}

	if _, err := time.Parse("2006-01-02", req.ShiftDate); err != nil {
		http.Error(w, "invalid shift_date", http.StatusBadRequest)
		return
	}

	var updatedID string
	err := db.Pool.QueryRow(
		r.Context(),
		`UPDATE schedules
		 SET shift_date = $1, start_time = $2, end_time = $3
		 WHERE id = $4
		 RETURNING id`,
		req.ShiftDate, req.StartTime, req.EndTime, id,
	).Scan(&updatedID)

	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, "shift not found", http.StatusNotFound)
		return
	}
	if err != nil {
		var pgError *pgconn.PgError
		if errors.As(err, &pgError) && pgError.Code == "22P02" {
			// The id in the URL isn't a valid UUID, so no shift can match it
			http.Error(w, "shift not found", http.StatusNotFound)
			return
		}
		log.Printf("error updating schedule: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{
		"id":      updatedID,
		"message": "shift updated",
	})
}

type deleteSchedulesRequest struct {
	IDs []string `json:"ids"`
}

const maxDeleteBatchSize = 200

func DeleteSchedules(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req deleteSchedulesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if len(req.IDs) == 0 {
		http.Error(w, "ids is required", http.StatusBadRequest)
		return
	}
	if len(req.IDs) > maxDeleteBatchSize {
		http.Error(w, fmt.Sprintf("cannot delete more than %d shifts at once", maxDeleteBatchSize), http.StatusBadRequest)
		return
	}

	// Sent as text and cast to uuid inside Postgres, so a malformed id fails
	// the whole statement instead of being half-processed.
	result, err := db.Pool.Exec(
		r.Context(),
		`DELETE FROM schedules WHERE id = ANY($1::text[]::uuid[])`,
		req.IDs,
	)
	if err != nil {
		var pgError *pgconn.PgError
		if errors.As(err, &pgError) && pgError.Code == "22P02" {
			http.Error(w, "one or more ids are invalid", http.StatusBadRequest)
			return
		}
		log.Printf("error deleting schedules: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	if result.RowsAffected() == 0 {
		http.Error(w, "no matching shifts found", http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(map[string]any{
		"deleted": result.RowsAffected(),
		"message": "shifts deleted",
	})
}

package handlers

import (
	"encoding/json"
	"log"
	"net/http"

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

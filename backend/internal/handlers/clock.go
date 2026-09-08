package handlers

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"

	"github.com/jackc/pgx/v5"

	"golf-maintenance/backend/internal/db"
)

type clockRequest struct {
	UserID string `json:"user_id"`
}

func ClockIn(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "http://localhost:5173")
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req clockRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.UserID == "" {
		http.Error(w, "user_id is required", http.StatusBadRequest)
		return
	}

	// Check if this user already has an open clock entry
	var existingID string
	err := db.Pool.QueryRow(
		r.Context(),
		`SELECT id FROM clock_entries WHERE user_id = $1 AND clock_out IS NULL`,
		req.UserID,
	).Scan(&existingID)

	if err == nil {
		http.Error(w, "user is already clocked in", http.StatusConflict)
		return
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		log.Printf("error checking clock status: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	var id string
	err = db.Pool.QueryRow(
		r.Context(),
		`INSERT INTO clock_entries (user_id) VALUES ($1) RETURNING id`,
		req.UserID,
	).Scan(&id)

	if err != nil {
		log.Printf("error creating clock entry: %v", err)
		http.Error(w, "could not clock in", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"id":      id,
		"message": "clocked in",
	})
}

func ClockOut(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "http://localhost:5173")
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req clockRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.UserID == "" {
		http.Error(w, "user_id is required", http.StatusBadRequest)
		return
	}

	var id string
	err := db.Pool.QueryRow(
		r.Context(),
		`UPDATE clock_entries
		 SET clock_out = now()
		 WHERE user_id = $1 AND clock_out IS NULL
		 RETURNING id`,
		req.UserID,
	).Scan(&id)

	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, "no open clock-in found for this user", http.StatusConflict)
		return
	}
	if err != nil {
		log.Printf("error clocking out: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{
		"id":      id,
		"message": "clocked out",
	})
}

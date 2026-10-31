package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"golf-maintenance/backend/internal/auth"
)

// GetMySchedule returns the logged-in person's own shifts and nobody else's. This
// comes from the session, not the request.
func GetMySchedule(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "not authenticated", http.StatusUnauthorized)
		return
	}

	shiftRange, problem := scheduleRangeFromQuery(r)
	if problem != "" {
		http.Error(w, problem, http.StatusBadRequest)
		return
	}

	schedules, err := listSchedules(r.Context(), &userID, shiftRange)
	if err != nil {
		log.Printf("error fetching my schedule: %v", err)
		http.Error(w, "could not fetch schedule", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(schedules)
}

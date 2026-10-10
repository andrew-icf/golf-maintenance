package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"golf-maintenance/backend/internal/db"
)

type rosterMember struct {
	ID       string  `json:"id"`
	FullName string  `json:"full_name"`
	JobTitle *string `json:"job_title"`
}

func GetRoster(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	rows, err := db.Pool.Query(
		r.Context(),
		`SELECT id, full_name, job_title FROM users WHERE role = 'staff' ORDER BY full_name`,
	)
	if err != nil {
		log.Printf("error fetching roster: %v", err)
		http.Error(w, "could not fetch roster", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	roster := []rosterMember{}
	for rows.Next() {
		var member rosterMember
		if err := rows.Scan(&member.ID, &member.FullName, &member.JobTitle); err != nil {
			log.Printf("error scanning roster member: %v", err)
			http.Error(w, "could not fetch roster", http.StatusInternalServerError)
			return
		}
		roster = append(roster, member)
	}

	json.NewEncoder(w).Encode(roster)
}

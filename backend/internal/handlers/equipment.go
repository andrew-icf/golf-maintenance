package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"golf-maintenance/backend/internal/db"
	"golf-maintenance/backend/internal/models"

	"github.com/go-chi/chi/v5"
)

type updateEquipmentStatusRequest struct {
	Status string `json:"status"`
}

var validStatuses = map[string]bool{
	"working_order": true,
	"needs_repair":  true,
	"in_shop":       true,
}

func UpdateEquipmentStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")

	var req updateEquipmentStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if !validStatuses[req.Status] {
		http.Error(w, "status must be one of: working_order, needs_repair, in_shop", http.StatusBadRequest)
		return
	}

	var updatedID string
	err := db.Pool.QueryRow(
		r.Context(),
		`UPDATE equipment SET status = $1 WHERE id = $2 RETURNING id`,
		req.Status, id,
	).Scan(&updatedID)

	if err != nil {
		http.Error(w, "equipment not found", http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{
		"id":      updatedID,
		"status":  req.Status,
		"message": "status updated",
	})
}

func GetEquipment(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Pool.Query(
		r.Context(),
		`SELECT id, type, label, status, parent_equipment_id, assigned_user_id, created_at
		 FROM equipment
		 ORDER BY label`,
	)
	if err != nil {
		log.Printf("error fetching equipment: %v", err)
		http.Error(w, "could not fetch equipment", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	equipment := []models.Equipment{}
	for rows.Next() {
		var e models.Equipment
		if err := rows.Scan(&e.ID, &e.Type, &e.Label, &e.Status, &e.ParentEquipmentID, &e.AssignedUserID, &e.CreatedAt); err != nil {
			log.Printf("error scanning equipment: %v", err)
			http.Error(w, "could not fetch equipment", http.StatusInternalServerError)
			return
		}
		equipment = append(equipment, e)
	}

	json.NewEncoder(w).Encode(equipment)
}

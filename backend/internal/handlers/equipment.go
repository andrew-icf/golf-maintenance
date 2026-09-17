package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"golf-maintenance/backend/internal/db"
	"golf-maintenance/backend/internal/models"
)

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

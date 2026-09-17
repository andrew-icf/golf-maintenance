package models

import "time"

type Equipment struct {
	ID                string    `json:"id"`
	Type              string    `json:"type"`
	Label             string    `json:"label"`
	Status            string    `json:"status"`
	ParentEquipmentID *string   `json:"parent_equipment_id"`
	AssignedUserID    *string   `json:"assigned_user_id"`
	CreatedAt         time.Time `json:"created_at"`
}

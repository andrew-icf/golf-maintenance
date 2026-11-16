package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"golf-maintenance/backend/internal/db"
	"golf-maintenance/backend/internal/models"
)

// GetHoleTasks sends the club's list of tasks for a hole, with the duties they belong to. The list
// is the same for every hole, since a hole has the tasks of the features it has. It is work
// information, so staff must be clocked in.
func GetHoleTasks(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	list := models.HoleTaskList{Duties: []models.Duty{}, Tasks: []models.HoleTask{}}

	dutyRows, err := db.Pool.Query(
		r.Context(),
		`SELECT id, code, name, position FROM duties ORDER BY position, code`,
	)
	if err != nil {
		log.Printf("error fetching duties: %v", err)
		http.Error(w, "could not fetch duties", http.StatusInternalServerError)
		return
	}
	defer dutyRows.Close()

	for dutyRows.Next() {
		var duty models.Duty
		if err := dutyRows.Scan(&duty.ID, &duty.Code, &duty.Name, &duty.Position); err != nil {
			log.Printf("error scanning duty: %v", err)
			http.Error(w, "could not fetch duties", http.StatusInternalServerError)
			return
		}
		list.Duties = append(list.Duties, duty)
	}
	if err := dutyRows.Err(); err != nil {
		log.Printf("error reading duties: %v", err)
		http.Error(w, "could not fetch duties", http.StatusInternalServerError)
		return
	}

	taskRows, err := db.Pool.Query(
		r.Context(),
		`SELECT id, code, feature_type::text, name, allowed_job_titles::text[], duty_id, position
		 FROM hole_tasks
		 ORDER BY position, code`,
	)
	if err != nil {
		log.Printf("error fetching hole tasks: %v", err)
		http.Error(w, "could not fetch hole tasks", http.StatusInternalServerError)
		return
	}
	defer taskRows.Close()

	for taskRows.Next() {
		var task models.HoleTask
		if err := taskRows.Scan(&task.ID, &task.Code, &task.FeatureType, &task.Name, &task.AllowedJobTitles, &task.DutyID, &task.Position); err != nil {
			log.Printf("error scanning hole task: %v", err)
			http.Error(w, "could not fetch hole tasks", http.StatusInternalServerError)
			return
		}

		// Postgres sends an empty list as no list at all, which the driver reads as nil, and nil
		// would reach the page as null instead of a list with nothing in it
		if task.AllowedJobTitles == nil {
			task.AllowedJobTitles = []string{}
		}
		list.Tasks = append(list.Tasks, task)
	}
	if err := taskRows.Err(); err != nil {
		log.Printf("error reading hole tasks: %v", err)
		http.Error(w, "could not fetch hole tasks", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(list)
}

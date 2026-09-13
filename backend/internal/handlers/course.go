package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"golf-maintenance/backend/internal/db"
	"golf-maintenance/backend/internal/models"
)

func GetCourse(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var course models.Course
	err := db.Pool.QueryRow(
		r.Context(),
		`SELECT id, name, created_at FROM courses LIMIT 1`,
	).Scan(&course.ID, &course.Name, &course.CreatedAt)

	if err != nil {
		log.Printf("error fetching course: %v", err)
		http.Error(w, "could not fetch course", http.StatusInternalServerError)
		return
	}

	rows, err := db.Pool.Query(
		r.Context(),
		`SELECT id, hole_number, par, yardage FROM holes WHERE course_id = $1 ORDER BY hole_number`,
		course.ID,
	)
	if err != nil {
		log.Printf("error fetching holes: %v", err)
		http.Error(w, "could not fetch holes", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	course.Holes = []models.Hole{}
	for rows.Next() {
		var h models.Hole
		if err := rows.Scan(&h.ID, &h.HoleNumber, &h.Par, &h.Yardage); err != nil {
			log.Printf("error scanning hole: %v", err)
			http.Error(w, "could not fetch holes", http.StatusInternalServerError)
			return
		}
		course.Holes = append(course.Holes, h)
	}

	amenityRows, err := db.Pool.Query(
		r.Context(),
		`SELECT id, name, type FROM amenities WHERE course_id = $1 ORDER BY name`,
		course.ID,
	)
	if err != nil {
		log.Printf("error fetching amenities: %v", err)
		http.Error(w, "could not fetch amenities", http.StatusInternalServerError)
		return
	}
	defer amenityRows.Close()

	course.Amenities = []models.Amenity{}
	for amenityRows.Next() {
		var a models.Amenity
		if err := amenityRows.Scan(&a.ID, &a.Name, &a.Type); err != nil {
			log.Printf("error scanning amenity: %v", err)
			http.Error(w, "could not fetch amenities", http.StatusInternalServerError)
			return
		}
		course.Amenities = append(course.Amenities, a)
	}

	json.NewEncoder(w).Encode(course)
}

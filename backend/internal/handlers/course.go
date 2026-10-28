package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"golf-maintenance/backend/internal/db"
	"golf-maintenance/backend/internal/models"
)

func GetCourse(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

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

	layoutRows, err := db.Pool.Query(
		r.Context(),
		`SELECT id, name, code, position, front_hole_count
		 FROM layouts
		 WHERE course_id = $1
		 ORDER BY position`,
		course.ID,
	)
	if err != nil {
		log.Printf("error fetching layouts: %v", err)
		http.Error(w, "could not fetch layouts", http.StatusInternalServerError)
		return
	}
	defer layoutRows.Close()

	course.Layouts = []models.Layout{}
	layoutIndexByID := map[string]int{}
	for layoutRows.Next() {
		layout := models.Layout{Holes: []models.Hole{}}
		if err := layoutRows.Scan(&layout.ID, &layout.Name, &layout.Code, &layout.Position, &layout.FrontHoleCount); err != nil {
			log.Printf("error scanning layout: %v", err)
			http.Error(w, "could not fetch layouts", http.StatusInternalServerError)
			return
		}
		layoutIndexByID[layout.ID] = len(course.Layouts)
		course.Layouts = append(course.Layouts, layout)
	}
	if err := layoutRows.Err(); err != nil {
		log.Printf("error reading layouts: %v", err)
		http.Error(w, "could not fetch layouts", http.StatusInternalServerError)
		return
	}

	holeRows, err := db.Pool.Query(
		r.Context(),
		`SELECT h.id, h.layout_id, h.hole_number, h.par, h.yardage
		 FROM holes h
		 JOIN layouts l ON l.id = h.layout_id
		 WHERE l.course_id = $1
		 ORDER BY l.position, h.hole_number`,
		course.ID,
	)
	if err != nil {
		log.Printf("error fetching holes: %v", err)
		http.Error(w, "could not fetch holes", http.StatusInternalServerError)
		return
	}
	defer holeRows.Close()

	course.Holes = []models.Hole{}
	for holeRows.Next() {
		var hole models.Hole
		if err := holeRows.Scan(&hole.ID, &hole.LayoutID, &hole.HoleNumber, &hole.Par, &hole.Yardage); err != nil {
			log.Printf("error scanning hole: %v", err)
			http.Error(w, "could not fetch holes", http.StatusInternalServerError)
			return
		}
		course.Holes = append(course.Holes, hole)

		// A layout added between the two queries would be missing from the map, so skip it
		// here rather than filing the hole under the wrong layout
		if layoutIndex, found := layoutIndexByID[hole.LayoutID]; found {
			course.Layouts[layoutIndex].Holes = append(course.Layouts[layoutIndex].Holes, hole)
		}
	}
	if err := holeRows.Err(); err != nil {
		log.Printf("error reading holes: %v", err)
		http.Error(w, "could not fetch holes", http.StatusInternalServerError)
		return
	}

	amenityRows, err := db.Pool.Query(
		r.Context(),
		`SELECT id, name, type, hole_id FROM amenities WHERE course_id = $1 ORDER BY name`,
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
		var amenity models.Amenity
		if err := amenityRows.Scan(&amenity.ID, &amenity.Name, &amenity.Type, &amenity.HoleID); err != nil {
			log.Printf("error scanning amenity: %v", err)
			http.Error(w, "could not fetch amenities", http.StatusInternalServerError)
			return
		}
		course.Amenities = append(course.Amenities, amenity)
	}
	if err := amenityRows.Err(); err != nil {
		log.Printf("error reading amenities: %v", err)
		http.Error(w, "could not fetch amenities", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(course)
}

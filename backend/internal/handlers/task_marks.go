package handlers

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"regexp"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"golf-maintenance/backend/internal/db"
	"golf-maintenance/backend/internal/models"
)

var idPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// isValidID says whether text is written like an id. A request with anything else for an id is a
// bad request, and without this check the database would refuse it and the person would see a 500.
func isValidID(id string) bool {
	return idPattern.MatchString(id)
}

// GetHoleMarks sends today's marks for one hole, with the club's date. Today is the club's own day,
// worked out from its timezone, since the database runs in UTC. Everyone sees every mark, so the
// only thing the request needs is the hole. It is work information, so staff must be clocked in.
func GetHoleMarks(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	holeID := chi.URLParam(r, "holeId")
	if !isValidID(holeID) {
		http.Error(w, "invalid hole id", http.StatusBadRequest)
		return
	}

	// The hole's own club decides what day it is, and no row means there is no such hole
	var clubDate string
	err := db.Pool.QueryRow(
		r.Context(),
		`SELECT (now() AT TIME ZONE courses.timezone)::date::text
		 FROM holes
		 JOIN layouts ON layouts.id = holes.layout_id
		 JOIN courses ON courses.id = layouts.course_id
		 WHERE holes.id = $1`,
		holeID,
	).Scan(&clubDate)
	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, "hole not found", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("error finding the club's date: %v", err)
		http.Error(w, "could not fetch marks", http.StatusInternalServerError)
		return
	}

	rows, err := db.Pool.Query(
		r.Context(),
		`SELECT task_marks.hole_feature_id, task_marks.task_id, task_marks.status::text,
		        task_marks.user_id, users.full_name, task_marks.marked_at
		 FROM task_marks
		 JOIN hole_features ON hole_features.id = task_marks.hole_feature_id
		 JOIN users ON users.id = task_marks.user_id
		 WHERE hole_features.hole_id = $1 AND task_marks.mark_date = $2::text::date
		 ORDER BY task_marks.marked_at, task_marks.id`,
		holeID, clubDate,
	)
	if err != nil {
		log.Printf("error fetching marks: %v", err)
		http.Error(w, "could not fetch marks", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	marks := []models.TaskMark{}
	for rows.Next() {
		var mark models.TaskMark
		if err := rows.Scan(&mark.FeatureID, &mark.TaskID, &mark.Status, &mark.UserID, &mark.UserName, &mark.MarkedAt); err != nil {
			log.Printf("error scanning mark: %v", err)
			http.Error(w, "could not fetch marks", http.StatusInternalServerError)
			return
		}
		marks = append(marks, mark)
	}
	if err := rows.Err(); err != nil {
		log.Printf("error reading marks: %v", err)
		http.Error(w, "could not fetch marks", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(models.HoleMarks{Date: clubDate, Marks: marks})
}

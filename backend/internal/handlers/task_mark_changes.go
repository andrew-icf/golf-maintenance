package handlers

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"golf-maintenance/backend/internal/auth"
	"golf-maintenance/backend/internal/db"
	"golf-maintenance/backend/internal/models"
)

const (
	markStatusDone     = "done"
	markStatusNotToday = "not_today"

	// What a person is told when someone has already marked the task the other way. The tablet shows it.
	markConflictMessage = "already marked, undo it first"
)

// What a request to change a mark is about, once it has been checked
type markTarget struct {
	userID    string
	featureID string
	taskID    string
	clubDate  string
}

// canCheckTask is the rule for who may check a task off, set it aside, or undo it. An admin may do
// anything, and anyone else only when their job title is on the task's list. The list may be empty,
// which means only admins.
func canCheckTask(role, jobTitle string, allowedJobTitles []string) bool {
	if role == "admin" {
		return true
	}
	for _, allowedTitle := range allowedJobTitles {
		if allowedTitle == jobTitle {
			return true
		}
	}
	return false
}

// checkMarkTarget finds the feature and the task a request names and says whether this person may
// change that mark. When it cannot, it has already told the person why and the caller stops. The
// order matters: a bad id is a 400, something that is not there is a 404, a task for another kind of
// feature is a 400, and only then is the person's own right to check it looked at.
func checkMarkTarget(w http.ResponseWriter, r *http.Request) (markTarget, bool) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "not authenticated", http.StatusUnauthorized)
		return markTarget{}, false
	}

	featureID := chi.URLParam(r, "featureId")
	taskID := chi.URLParam(r, "taskId")
	if !isValidID(featureID) {
		http.Error(w, "invalid feature id", http.StatusBadRequest)
		return markTarget{}, false
	}
	if !isValidID(taskID) {
		http.Error(w, "invalid task id", http.StatusBadRequest)
		return markTarget{}, false
	}

	// The feature's own club decides what day it is
	var featureType, clubDate string
	err := db.Pool.QueryRow(
		r.Context(),
		`SELECT hole_features.feature_type::text, (now() AT TIME ZONE courses.timezone)::date::text
		 FROM hole_features
		 JOIN holes ON holes.id = hole_features.hole_id
		 JOIN layouts ON layouts.id = holes.layout_id
		 JOIN courses ON courses.id = layouts.course_id
		 WHERE hole_features.id = $1`,
		featureID,
	).Scan(&featureType, &clubDate)
	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, "feature not found", http.StatusNotFound)
		return markTarget{}, false
	}
	if err != nil {
		log.Printf("error finding the feature: %v", err)
		http.Error(w, "could not check the task", http.StatusInternalServerError)
		return markTarget{}, false
	}

	var taskFeatureType string
	var allowedJobTitles []string
	err = db.Pool.QueryRow(
		r.Context(),
		`SELECT feature_type::text, allowed_job_titles::text[] FROM hole_tasks WHERE id = $1`,
		taskID,
	).Scan(&taskFeatureType, &allowedJobTitles)
	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, "task not found", http.StatusNotFound)
		return markTarget{}, false
	}
	if err != nil {
		log.Printf("error finding the task: %v", err)
		http.Error(w, "could not check the task", http.StatusInternalServerError)
		return markTarget{}, false
	}

	if taskFeatureType != featureType {
		http.Error(w, "this task does not belong to that feature", http.StatusBadRequest)
		return markTarget{}, false
	}

	var role, jobTitle string
	err = db.Pool.QueryRow(
		r.Context(),
		`SELECT role, COALESCE(job_title::text, '') FROM users WHERE id = $1`,
		userID,
	).Scan(&role, &jobTitle)
	if err != nil {
		log.Printf("error finding the person: %v", err)
		http.Error(w, "could not check the task", http.StatusInternalServerError)
		return markTarget{}, false
	}

	// This message must never be the clock-in one, since the page brings up the clock-in screen
	// when it sees that
	if !canCheckTask(role, jobTitle, allowedJobTitles) {
		http.Error(w, "you are not allowed to check this task", http.StatusForbidden)
		return markTarget{}, false
	}

	return markTarget{userID: userID, featureID: featureID, taskID: taskID, clubDate: clubDate}, true
}

// SetTaskMark checks a task off or sets it aside for the club's day. The first person to mark a task
// stays on record: the same status again changes nothing, and the other status is refused until
// someone undoes the mark. It is one statement, so two taps at the same moment cannot both win.
func SetTaskMark(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var body struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if body.Status != markStatusDone && body.Status != markStatusNotToday {
		http.Error(w, "status must be done or not_today", http.StatusBadRequest)
		return
	}

	target, ok := checkMarkTarget(w, r)
	if !ok {
		return
	}

	// When the task is already marked, the update changes nothing and sends back the mark that is
	// there, so the person is told who has it
	var mark models.TaskMark
	err := db.Pool.QueryRow(
		r.Context(),
		`INSERT INTO task_marks (mark_date, hole_feature_id, task_id, status, user_id)
		 VALUES ($1::text::date, $2, $3, $4::text::task_mark_status, $5)
		 ON CONFLICT (mark_date, hole_feature_id, task_id)
		 DO UPDATE SET status = task_marks.status
		 RETURNING hole_feature_id, task_id, status::text, user_id,
		           (SELECT users.full_name FROM users WHERE users.id = task_marks.user_id), marked_at`,
		target.clubDate, target.featureID, target.taskID, body.Status, target.userID,
	).Scan(&mark.FeatureID, &mark.TaskID, &mark.Status, &mark.UserID, &mark.UserName, &mark.MarkedAt)
	if err != nil {
		log.Printf("error setting the mark: %v", err)
		http.Error(w, "could not save the mark", http.StatusInternalServerError)
		return
	}

	if mark.Status != body.Status {
		http.Error(w, markConflictMessage, http.StatusConflict)
		return
	}

	json.NewEncoder(w).Encode(mark)
}

// ClearTaskMark undoes a mark for the club's day. Anyone who may check the task may undo it, whoever
// made the mark. Undoing a task nobody marked is not an error, since the page may be a moment behind.
func ClearTaskMark(w http.ResponseWriter, r *http.Request) {
	target, ok := checkMarkTarget(w, r)
	if !ok {
		return
	}

	_, err := db.Pool.Exec(
		r.Context(),
		`DELETE FROM task_marks
		 WHERE mark_date = $1::text::date AND hole_feature_id = $2 AND task_id = $3`,
		target.clubDate, target.featureID, target.taskID,
	)
	if err != nil {
		log.Printf("error clearing the mark: %v", err)
		http.Error(w, "could not undo the mark", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

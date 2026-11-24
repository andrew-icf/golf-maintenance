package handlers

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"

	"github.com/jackc/pgx/v5"

	"golf-maintenance/backend/internal/db"
	"golf-maintenance/backend/internal/models"
)

// GetCourseTasks sends the club's course tasks in their order, with today's marks and the club's
// date. Today is the club's own day, worked out from its timezone, since the database runs in UTC.
// Everyone sees every task and every mark, and the task's list of job titles is sent so the page
// can show who may check it. It is work information, so staff must be clocked in.
func GetCourseTasks(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// The same course GetCourse shows
	var courseID, clubDate string
	err := db.Pool.QueryRow(
		r.Context(),
		`SELECT id, (now() AT TIME ZONE timezone)::date::text FROM courses LIMIT 1`,
	).Scan(&courseID, &clubDate)
	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, "course not found", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("error finding the course: %v", err)
		http.Error(w, "could not fetch course tasks", http.StatusInternalServerError)
		return
	}

	taskRows, err := db.Pool.Query(
		r.Context(),
		`SELECT id, code, name, allowed_job_titles::text[], position
		 FROM course_tasks
		 WHERE course_id = $1
		 ORDER BY position, id`,
		courseID,
	)
	if err != nil {
		log.Printf("error fetching course tasks: %v", err)
		http.Error(w, "could not fetch course tasks", http.StatusInternalServerError)
		return
	}
	defer taskRows.Close()

	tasks := []models.CourseTask{}
	for taskRows.Next() {
		var task models.CourseTask
		if err := taskRows.Scan(&task.ID, &task.Code, &task.Name, &task.AllowedJobTitles, &task.Position); err != nil {
			log.Printf("error scanning course task: %v", err)
			http.Error(w, "could not fetch course tasks", http.StatusInternalServerError)
			return
		}
		tasks = append(tasks, task)
	}
	if err := taskRows.Err(); err != nil {
		log.Printf("error reading course tasks: %v", err)
		http.Error(w, "could not fetch course tasks", http.StatusInternalServerError)
		return
	}

	markRows, err := db.Pool.Query(
		r.Context(),
		`SELECT course_task_marks.course_task_id, course_task_marks.status::text,
		        course_task_marks.user_id, users.full_name, course_task_marks.marked_at
		 FROM course_task_marks
		 JOIN course_tasks ON course_tasks.id = course_task_marks.course_task_id
		 JOIN users ON users.id = course_task_marks.user_id
		 WHERE course_tasks.course_id = $1 AND course_task_marks.mark_date = $2::text::date
		 ORDER BY course_task_marks.marked_at, course_task_marks.id`,
		courseID, clubDate,
	)
	if err != nil {
		log.Printf("error fetching course task marks: %v", err)
		http.Error(w, "could not fetch course tasks", http.StatusInternalServerError)
		return
	}
	defer markRows.Close()

	marks := []models.CourseTaskMark{}
	for markRows.Next() {
		var mark models.CourseTaskMark
		if err := markRows.Scan(&mark.TaskID, &mark.Status, &mark.UserID, &mark.UserName, &mark.MarkedAt); err != nil {
			log.Printf("error scanning course task mark: %v", err)
			http.Error(w, "could not fetch course tasks", http.StatusInternalServerError)
			return
		}
		marks = append(marks, mark)
	}
	if err := markRows.Err(); err != nil {
		log.Printf("error reading course task marks: %v", err)
		http.Error(w, "could not fetch course tasks", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(models.CourseTasks{Date: clubDate, Tasks: tasks, Marks: marks})
}

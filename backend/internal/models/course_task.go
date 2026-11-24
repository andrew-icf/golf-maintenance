package models

import "time"

// One task on the club's list of course tasks, such as mowing or edging. AllowedJobTitles is who
// may check it besides admins.
type CourseTask struct {
	ID               string   `json:"id"`
	Code             string   `json:"code"`
	Name             string   `json:"name"`
	AllowedJobTitles []string `json:"allowed_job_titles"`
	Position         int      `json:"position"`
}

// Who marked a course task for the club's current day, and how
type CourseTaskMark struct {
	TaskID   string    `json:"task_id"`
	Status   string    `json:"status"`
	UserID   string    `json:"user_id"`
	UserName string    `json:"user_name"`
	MarkedAt time.Time `json:"marked_at"`
}

// The club's course tasks with today's marks. Date is the club's date, so the page knows which day
// the marks belong to.
type CourseTasks struct {
	Date  string           `json:"date"`
	Tasks []CourseTask     `json:"tasks"`
	Marks []CourseTaskMark `json:"marks"`
}

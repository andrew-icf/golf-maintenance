package models

import "time"

// One task on one feature of a hole, checked off or set aside for the day. A bunker's task is
// marked on the bunker's own feature, which is how it knows which bunker.
type TaskMark struct {
	FeatureID string    `json:"feature_id"`
	TaskID    string    `json:"task_id"`
	Status    string    `json:"status"`
	UserID    string    `json:"user_id"`
	UserName  string    `json:"user_name"`
	MarkedAt  time.Time `json:"marked_at"`
}

// A hole's marks for the club's current day. Date is the club's date, so the page knows which day
// the marks belong to.
type HoleMarks struct {
	Date  string     `json:"date"`
	Marks []TaskMark `json:"marks"`
}

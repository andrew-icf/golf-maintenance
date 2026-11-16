package models

// A duty groups tasks by who is answerable for them, such as Greens or Bunkers
type Duty struct {
	ID       string `json:"id"`
	Code     string `json:"code"`
	Name     string `json:"name"`
	Position int    `json:"position"`
}

// One task in the club's list for a hole. It belongs to a kind of feature, so a hole has it when
// the hole has a feature of that kind, and once for each such feature. AllowedJobTitles is who may
// check it off, and it may be empty, meaning only admins may.
type HoleTask struct {
	ID               string   `json:"id"`
	Code             string   `json:"code"`
	FeatureType      string   `json:"feature_type"`
	Name             string   `json:"name"`
	AllowedJobTitles []string `json:"allowed_job_titles"`
	DutyID           string   `json:"duty_id"`
	Position         int      `json:"position"`
}

type HoleTaskList struct {
	Duties []Duty     `json:"duties"`
	Tasks  []HoleTask `json:"tasks"`
}

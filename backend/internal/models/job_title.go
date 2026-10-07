package models

// Each job title maps to exactly one permission tier. This map is the single
// source of truth: a user's role is derived from it when the user is created.
var roleByJobTitle = map[string]string{
	"superintendent":           "admin",
	"assistant_superintendent": "admin",
	"master_mechanic":          "admin",
	"operator":                 "staff",
	"gardener":                 "staff",
	"landscaper":               "staff",
	"mechanic":                 "staff",
	"office_admin":             "staff",
}

func RoleForJobTitle(jobTitle string) (string, bool) {
	role, found := roleByJobTitle[jobTitle]
	return role, found
}

func JobTitles() []string {
	jobTitles := make([]string, 0, len(roleByJobTitle))
	for jobTitle := range roleByJobTitle {
		jobTitles = append(jobTitles, jobTitle)
	}
	return jobTitles
}

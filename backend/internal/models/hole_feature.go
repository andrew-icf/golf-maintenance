package models

// The kinds of feature a hole can have, in the order the database lists them. This list must match
// the hole_feature_type enum, and a test checks that the two agree.
var holeFeatureTypes = []string{
	"tee_box",
	"par_3_tee_box",
	"fairway",
	"approach",
	"rough",
	"green",
	"bunker",
}

// The features every hole has exactly one of. Bunkers are not among them, since the number of
// bunkers varies from hole to hole. The database gives every new hole these, and a test checks
// that it does.
var standardHoleFeatureTypes = []string{
	"tee_box",
	"par_3_tee_box",
	"fairway",
	"approach",
	"rough",
	"green",
}

func HoleFeatureTypes() []string {
	return append([]string(nil), holeFeatureTypes...)
}

func StandardHoleFeatureTypes() []string {
	return append([]string(nil), standardHoleFeatureTypes...)
}

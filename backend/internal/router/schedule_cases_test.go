package router_test

// Ranges every schedule endpoint must refuse with a 400, as the query string that follows
// the path
var invalidRangeQueries = []struct {
	name  string
	query string
}{
	{"start without end", "start=2026-10-04"},
	{"end without start", "end=2026-10-10"},
	{"malformed start", "start=banana&end=2026-10-10"},
	{"malformed end", "start=2026-10-04&end=banana"},
	{"date without zero padding", "start=2026-10-4&end=2026-10-10"},
	{"end before start", "start=2026-10-10&end=2026-10-04"},
	{"range of 63 days", "start=2026-01-01&end=2026-03-05"},
}

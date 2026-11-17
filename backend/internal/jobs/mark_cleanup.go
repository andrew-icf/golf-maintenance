package jobs

import (
	"context"
	"log"

	"golf-maintenance/backend/internal/db"
)

// MarkRetentionDays is how long a day's marks are kept. A mark stays until its day is more than this
// many days behind the club's today, so a mark from exactly this many days ago is still kept.
const MarkRetentionDays = 14

// DeleteOldTaskMarks deletes the marks that are past their retention and says how many it deleted.
// Today is the club's own day, worked out from its timezone, the same way the checklist works it out.
func DeleteOldTaskMarks(ctx context.Context) (int64, error) {
	tag, err := db.Pool.Exec(
		ctx,
		`DELETE FROM task_marks
		 USING hole_features, holes, layouts, courses
		 WHERE hole_features.id = task_marks.hole_feature_id
		   AND holes.id = hole_features.hole_id
		   AND layouts.id = holes.layout_id
		   AND courses.id = layouts.course_id
		   AND task_marks.mark_date < (now() AT TIME ZONE courses.timezone)::date - $1::int`,
		MarkRetentionDays,
	)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

// CleanUpOldMarks is the job the server runs. It deletes the old marks and says so in the log when it
// has deleted any, and a problem is logged and never stops the server.
func CleanUpOldMarks(ctx context.Context) {
	deleted, err := DeleteOldTaskMarks(ctx)
	if err != nil {
		log.Printf("error cleaning up old marks: %v", err)
		return
	}
	if deleted > 0 {
		log.Printf("deleted %d marks older than %d days", deleted, MarkRetentionDays)
	}
}

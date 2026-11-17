-- +goose Up
-- The club's day follows its own timezone, since the database runs in UTC and a check made late in
-- the afternoon would otherwise land on tomorrow. The check refuses a name Postgres does not know.
ALTER TABLE courses
    ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Pacific/Honolulu'
    CONSTRAINT courses_timezone_valid CHECK ((now() AT TIME ZONE timezone) IS NOT NULL);

CREATE TYPE task_mark_status AS ENUM ('done', 'not_today');

-- One row for a task on a feature of a hole on a day: it is checked off, or set aside for the day.
-- A task with no row is still open, and undoing a mark deletes its row, so only the latest state is
-- kept. A bunker task is marked on the bunker's own feature, which is how it knows which bunker.
CREATE TABLE task_marks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mark_date DATE NOT NULL,
    hole_feature_id UUID NOT NULL,
    task_id UUID NOT NULL,
    status task_mark_status NOT NULL,
    user_id UUID NOT NULL,
    marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT task_marks_unique_per_day UNIQUE (mark_date, hole_feature_id, task_id),
    CONSTRAINT task_marks_hole_feature_id_fkey FOREIGN KEY (hole_feature_id) REFERENCES hole_features(id) ON DELETE CASCADE,
    CONSTRAINT task_marks_task_id_fkey FOREIGN KEY (task_id) REFERENCES hole_tasks(id) ON DELETE CASCADE,
    CONSTRAINT task_marks_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)
);

-- +goose Down
DROP TABLE IF EXISTS task_marks;
DROP TYPE IF EXISTS task_mark_status;
ALTER TABLE courses DROP COLUMN IF EXISTS timezone;
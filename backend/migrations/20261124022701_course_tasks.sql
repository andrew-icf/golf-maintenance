-- +goose Up
CREATE TABLE course_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    allowed_job_titles job_title_type[] NOT NULL,
    position INTEGER NOT NULL,
    CONSTRAINT course_tasks_code_unique UNIQUE (course_id, code),
    CONSTRAINT course_tasks_code_format CHECK (code ~ '^[a-z][a-z0-9_]*$'),
    CONSTRAINT course_tasks_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT course_tasks_allowed_job_titles_not_empty CHECK (cardinality(allowed_job_titles) > 0),
    CONSTRAINT course_tasks_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE course_task_marks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mark_date DATE NOT NULL,
    course_task_id UUID NOT NULL,
    status task_mark_status NOT NULL,
    user_id UUID NOT NULL,
    marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT course_task_marks_unique_per_day UNIQUE (mark_date, course_task_id),
    CONSTRAINT course_task_marks_course_task_id_fkey FOREIGN KEY (course_task_id) REFERENCES course_tasks(id) ON DELETE CASCADE,
    CONSTRAINT course_task_marks_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX course_task_marks_mark_date_idx ON course_task_marks (mark_date);

-- +goose Down
DROP TABLE course_task_marks;
DROP TABLE course_tasks;
-- +goose Up
-- Who is answerable for a group of tasks, such as Greens or Bunkers. Operators hold these across
-- the whole club, and the people who hold them are added in a later step.
CREATE TABLE duties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT duties_code_key UNIQUE (code),
    CONSTRAINT duties_name_not_blank CHECK (name ~ '\S'),
    CONSTRAINT duties_position_positive CHECK (position >= 1)
);

-- The club's list of tasks for a hole. A task belongs to a kind of feature, and every hole that
-- has a feature of that kind gets the task. A task for a bunker is made once for each bunker. The
-- code is a short name that stays the same when the task is renamed, so checks can point at it.
CREATE TABLE hole_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL,
    feature_type hole_feature_type NOT NULL,
    name TEXT NOT NULL,
    allowed_job_titles job_title_type[] NOT NULL DEFAULT '{}',
    duty_id UUID NOT NULL,
    position INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT hole_tasks_code_key UNIQUE (code),
    CONSTRAINT hole_tasks_name_not_blank CHECK (name ~ '\S'),
    CONSTRAINT hole_tasks_position_positive CHECK (position >= 1),
    CONSTRAINT hole_tasks_duty_id_fkey FOREIGN KEY (duty_id) REFERENCES duties(id) ON DELETE RESTRICT
);

-- +goose Down
DROP TABLE IF EXISTS hole_tasks;
DROP TABLE IF EXISTS duties;
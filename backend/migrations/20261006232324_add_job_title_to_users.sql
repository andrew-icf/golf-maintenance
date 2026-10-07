-- +goose Up
CREATE TYPE job_title_type AS ENUM (
    'superintendent',
    'assistant_superintendent',
    'master_mechanic',
    'operator',
    'gardener',
    'landscaper',
    'mechanic',
    'office_admin'
);

ALTER TABLE users ADD COLUMN job_title job_title_type;

-- +goose Down
ALTER TABLE users DROP COLUMN job_title;
DROP TYPE job_title_type;
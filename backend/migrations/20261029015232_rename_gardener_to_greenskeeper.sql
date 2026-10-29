-- +goose Up
ALTER TYPE job_title_type RENAME VALUE 'gardener' TO 'greenskeeper';

-- +goose Down
ALTER TYPE job_title_type RENAME VALUE 'greenskeeper' TO 'gardener';
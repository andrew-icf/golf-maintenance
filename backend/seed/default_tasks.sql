-- A new club starts from this list.
-- Safe to rerun, since it adds anything missing and puts the duties and tasks listed here back to
-- these defaults. So do not rerun it once the superintendent has edited the list (roadmap step 16).
-- Duties and tasks it does not list are left alone.
-- The order of the tasks is their order on the page: within each column of a section, a task comes
-- after the ones with a lower position.

BEGIN;

INSERT INTO duties (code, name, position)
VALUES
    ('greenskeeper', 'Greenskeeper tasks', 1),
    ('bunkers', 'Bunkers', 2),
    ('greens', 'Greens', 3),
    ('rolling', 'Rolling', 4),
    ('spraying', 'Spraying', 5),
    ('rough', 'Rough', 6),
    ('tees_and_fairways', 'Tees and fairways', 7)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, position = EXCLUDED.position;

INSERT INTO hole_tasks (code, feature_type, name, allowed_job_titles, duty_id, position)
SELECT
    task_list.code,
    task_list.feature_type::hole_feature_type,
    task_list.name,
    ARRAY[task_list.job_title::job_title_type],
    duties.id,
    task_list.position
FROM (VALUES
    ('tee-box-cleared', 'tee_box', 'Cleared', 'greenskeeper', 'greenskeeper', 1),
    ('collect-garbage', 'tee_box', 'Collect garbage', 'greenskeeper', 'greenskeeper', 2),
    ('tee-box-mowed', 'tee_box', 'Mowed', 'operator', 'tees_and_fairways', 3),
    ('par-3-tee-box-cleared', 'par_3_tee_box', 'Cleared', 'greenskeeper', 'greenskeeper', 4),
    ('par-3-tee-box-mowed', 'par_3_tee_box', 'Mowed', 'operator', 'tees_and_fairways', 5),
    ('fairway-mowed', 'fairway', 'Fairway mowed', 'operator', 'tees_and_fairways', 6),
    ('cart-signs', 'fairway', 'Cart signs', 'greenskeeper', 'greenskeeper', 7),
    ('fairway-sprayed', 'fairway', 'Fairway sprayed', 'operator', 'spraying', 8),
    ('rough-mowed', 'rough', 'Rough mowed', 'operator', 'rough', 9),
    ('bunker-raked-machine', 'bunker', 'Raked by machine', 'operator', 'bunkers', 10),
    ('bunker-raked-hand', 'bunker', 'Raked by hand', 'greenskeeper', 'greenskeeper', 11),
    ('pin-placement', 'green', 'Pin placement', 'greenskeeper', 'greenskeeper', 12),
    ('ball-marks', 'green', 'Ball marks', 'greenskeeper', 'greenskeeper', 13),
    ('top-dress', 'green', 'Top dress', 'greenskeeper', 'greenskeeper', 14),
    ('green-mowed', 'green', 'Mowed', 'operator', 'greens', 15),
    ('green-rolled', 'green', 'Rolled', 'operator', 'rolling', 16),
    ('green-sprayed', 'green', 'Sprayed', 'operator', 'spraying', 17)
) AS task_list(code, feature_type, name, job_title, duty_code, position)
JOIN duties ON duties.code = task_list.duty_code
ON CONFLICT (code) DO UPDATE
SET feature_type = EXCLUDED.feature_type,
    name = EXCLUDED.name,
    allowed_job_titles = EXCLUDED.allowed_job_titles,
    duty_id = EXCLUDED.duty_id,
    position = EXCLUDED.position;

COMMIT;

-- The list now
SELECT hole_tasks.position, hole_tasks.feature_type, hole_tasks.name,
       array_to_string(hole_tasks.allowed_job_titles, ',') AS may_check,
       duties.name AS duty
FROM hole_tasks
JOIN duties ON duties.id = hole_tasks.duty_id
ORDER BY hole_tasks.position;
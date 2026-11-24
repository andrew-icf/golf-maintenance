-- Default course tasks (roadmap step 10). Safe to rerun: matches on
-- (course, code), so renaming or reordering here updates the rows.
INSERT INTO course_tasks (course_id, code, name, allowed_job_titles, position)
SELECT c.id, v.code, v.name,
       ARRAY['landscaper', 'greenskeeper']::job_title_type[], v.position
FROM courses c
CROSS JOIN (VALUES
    ('mowing',                'Mowing',                1),
    ('edging',                'Edging',                2),
    ('wear_repair',           'Wear Repair',           3),
    ('irrigation_management', 'Irrigation management', 4),
    ('gardening',             'Gardening',             5),
    ('pruning',               'Pruning',               6),
    ('general_clean_up',      'General Clean up',      7),
    ('garbage',               'Garbage',               8)
) AS v (code, name, position)
ON CONFLICT (course_id, code) DO UPDATE
SET name = EXCLUDED.name,
    allowed_job_titles = EXCLUDED.allowed_job_titles,
    position = EXCLUDED.position;
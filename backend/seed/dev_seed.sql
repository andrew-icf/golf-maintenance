-- Dev-only sample data: a Star Wars maintenance crew with four weeks of shifts.
-- Safe to run repeatedly: users are created once, and the crew's shifts are
-- rebuilt on every run around the current week.
-- Every crew member's password is 'password123'. Never run this anywhere real.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TEMP TABLE crew (
    crew_position INTEGER NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    job_title job_title_type NOT NULL
);

INSERT INTO crew (crew_position, full_name, email, job_title) VALUES
    (0,  'Luke Skywalker',   'luke.skywalker@example.com',   'operator'),
    (1,  'Leia Organa',      'leia.organa@example.com',      'office_admin'),
    (2,  'Han Solo',         'han.solo@example.com',         'operator'),
    (3,  'Chewbacca',        'chewbacca@example.com',        'mechanic'),
    (4,  'Lando Calrissian', 'lando.calrissian@example.com', 'gardener'),
    (5,  'Yoda',             'yoda@example.com',             'gardener'),
    (6,  'Obi-Wan Kenobi',   'obi-wan.kenobi@example.com',   'landscaper'),
    (7,  'Anakin Skywalker', 'anakin.skywalker@example.com', 'mechanic'),
    (8,  'Padmé Amidala',    'padme.amidala@example.com',    'gardener'),
    (9,  'Mace Windu',       'mace.windu@example.com',       'operator'),
    (10, 'Ahsoka Tano',      'ahsoka.tano@example.com',      'landscaper'),
    (11, 'Rey',              'rey@example.com',              'operator'),
    (12, 'Finn',             'finn@example.com',             'gardener'),
    (13, 'Poe Dameron',      'poe.dameron@example.com',      'operator'),
    (14, 'Din Djarin',       'din.djarin@example.com',       'mechanic'),
    (15, 'Grogu',            'grogu@example.com',            'landscaper'),
    (16, 'Boba Fett',        'boba.fett@example.com',        'landscaper'),
    (17, 'Wedge Antilles',   'wedge.antilles@example.com',   'operator'),
    (18, 'Qui-Gon Jinn',     'qui-gon.jinn@example.com',     'gardener'),
    (19, 'Jyn Erso',         'jyn.erso@example.com',         'landscaper');

-- Every title above is in the staff tier
INSERT INTO users (email, password_hash, full_name, role, job_title)
SELECT email, crypt('password123', gen_salt('bf', 10)), full_name, 'staff', job_title
FROM crew
ON CONFLICT (email) DO NOTHING;

-- Start from a clean slate for the crew's shifts
DELETE FROM schedules
WHERE user_id IN (SELECT id FROM users WHERE email IN (SELECT email FROM crew));

-- Last week, this week, and the next two (weeks start on Sunday).
-- Everyone works five days with two days off, and crews start at one of four times.
INSERT INTO schedules (user_id, shift_date, start_time, end_time)
SELECT
    users.id,
    shift_day.shift_date,
    CASE crew.crew_position % 4
        WHEN 0 THEN TIME '04:00'
        WHEN 1 THEN TIME '05:30'
        WHEN 2 THEN TIME '06:00'
        ELSE TIME '07:00'
    END,
    CASE crew.crew_position % 4
        WHEN 0 THEN TIME '13:00'
        WHEN 1 THEN TIME '14:00'
        WHEN 2 THEN TIME '14:30'
        ELSE TIME '15:30'
    END
FROM crew
JOIN users ON users.email = crew.email
CROSS JOIN LATERAL (
    SELECT (current_date - EXTRACT(DOW FROM current_date)::int + day_offset) AS shift_date
    FROM generate_series(-7, 20) AS day_offset
) AS shift_day
WHERE EXTRACT(DOW FROM shift_day.shift_date)::int
    NOT IN (crew.crew_position % 7, (crew.crew_position + 3) % 7);

-- A split day: Yoda also waters in the evening on Tuesday of this week
INSERT INTO schedules (user_id, shift_date, start_time, end_time)
SELECT users.id, current_date - EXTRACT(DOW FROM current_date)::int + 2, TIME '17:00', TIME '20:00'
FROM users
WHERE users.email = 'yoda@example.com';

-- Two people on leave for the whole current week
DELETE FROM schedules
USING users
WHERE schedules.user_id = users.id
  AND users.email IN ('han.solo@example.com', 'boba.fett@example.com')
  AND schedules.shift_date BETWEEN current_date - EXTRACT(DOW FROM current_date)::int
                               AND current_date - EXTRACT(DOW FROM current_date)::int + 6;
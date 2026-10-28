-- Dev only: sets up Prince Waikiki as three nines (Course A, B, and C) with their real
-- pars and yardages, and puts the comfort stations on the holes they sit on.
-- Safe to rerun, since it rebuilds the club's courses, holes, and comfort stations from
-- scratch each time. That also means it must not be run once real assignments point at
-- holes, because rebuilding the holes would orphan them.

BEGIN;

CREATE TEMP TABLE dev_club (id UUID NOT NULL);

INSERT INTO courses (name)
SELECT 'Prince Waikiki'
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE name = 'Prince Waikiki');

INSERT INTO dev_club
SELECT id FROM courses WHERE name = 'Prince Waikiki' ORDER BY created_at LIMIT 1;

-- Remove the old courses. Their holes go with them, and any amenity on one of those holes
-- is kept, just unlinked.
DELETE FROM layouts WHERE course_id = (SELECT id FROM dev_club);

-- Front is holes 1 to 5 on every course here, and the back is the rest
INSERT INTO layouts (course_id, name, code, position, front_hole_count)
SELECT (SELECT id FROM dev_club), 'Course ' || course_list.code, course_list.code, course_list.position, 5
FROM (VALUES ('A', 1), ('B', 2), ('C', 3)) AS course_list(code, position);

INSERT INTO holes (layout_id, hole_number, par, yardage)
SELECT layouts.id, hole_list.hole_number, hole_list.par, hole_list.yardage
FROM (VALUES
    ('A', 1, 4, 409), ('A', 2, 5, 518), ('A', 3, 3, 168), ('A', 4, 4, 452), ('A', 5, 3, 191),
    ('A', 6, 4, 363), ('A', 7, 4, 418), ('A', 8, 5, 543), ('A', 9, 4, 452),
    ('B', 1, 4, 395), ('B', 2, 4, 455), ('B', 3, 5, 567), ('B', 4, 3, 164), ('B', 5, 4, 418),
    ('B', 6, 5, 546), ('B', 7, 3, 189), ('B', 8, 4, 426), ('B', 9, 4, 440),
    ('C', 1, 4, 481), ('C', 2, 4, 459), ('C', 3, 3, 174), ('C', 4, 4, 405), ('C', 5, 4, 398),
    ('C', 6, 5, 532), ('C', 7, 3, 210), ('C', 8, 4, 458), ('C', 9, 5, 532)
) AS hole_list(code, hole_number, par, yardage)
JOIN layouts
    ON layouts.code = hole_list.code
    AND layouts.course_id = (SELECT id FROM dev_club);

-- Comfort stations sit on a hole, so whoever has that hole looks after them
DELETE FROM amenities
WHERE course_id = (SELECT id FROM dev_club) AND type = 'comfort_station';

INSERT INTO amenities (course_id, name, type, hole_id)
SELECT
    (SELECT id FROM dev_club),
    'Comfort Station ' || station.code || station.hole_number::text,
    'comfort_station',
    holes.id
FROM (VALUES ('A', 5), ('B', 6), ('C', 7)) AS station(code, hole_number)
JOIN layouts
    ON layouts.code = station.code
    AND layouts.course_id = (SELECT id FROM dev_club)
JOIN holes
    ON holes.layout_id = layouts.id
    AND holes.hole_number = station.hole_number;

-- Amenities that belong to the club as a whole, added only if they are missing
INSERT INTO amenities (course_id, name, type)
SELECT (SELECT id FROM dev_club), club_amenity.amenity_name, club_amenity.amenity_type
FROM (VALUES ('Clubhouse', 'clubhouse'), ('Driving Range', 'driving_range'))
    AS club_amenity(amenity_name, amenity_type)
WHERE NOT EXISTS (
    SELECT 1 FROM amenities
    WHERE course_id = (SELECT id FROM dev_club) AND name = club_amenity.amenity_name
);

COMMIT;

-- What the club looks like now
SELECT layouts.name, layouts.code, layouts.front_hole_count,
       COUNT(holes.id) AS holes, SUM(holes.par) AS par, SUM(holes.yardage) AS yards
FROM layouts
LEFT JOIN holes ON holes.layout_id = layouts.id
WHERE layouts.course_id = (SELECT id FROM dev_club)
GROUP BY layouts.id
ORDER BY layouts.position;
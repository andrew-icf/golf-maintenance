-- Dev only: PLACEHOLDER bunker counts for Prince Waikiki's 27 holes. These numbers are made up
-- so the checklist has something to show. Replace them with the real counts when they are known.
-- Safe to rerun, since it rebuilds every bunker on these holes each time.
-- Run it after dev_course.sql: that script rebuilds the holes, which removes their bunkers.

BEGIN;

CREATE TEMP TABLE dev_bunker_counts (
    code TEXT NOT NULL,
    hole_number INTEGER NOT NULL,
    bunkers INTEGER NOT NULL
);

INSERT INTO dev_bunker_counts (code, hole_number, bunkers) VALUES
    ('A', 1, 3), ('A', 2, 2), ('A', 3, 4), ('A', 4, 5), ('A', 5, 2),
    ('A', 6, 3), ('A', 7, 4), ('A', 8, 3), ('A', 9, 5),
    ('B', 1, 4), ('B', 2, 3), ('B', 3, 2), ('B', 4, 5), ('B', 5, 3),
    ('B', 6, 4), ('B', 7, 2), ('B', 8, 5), ('B', 9, 3),
    ('C', 1, 2), ('C', 2, 4), ('C', 3, 3), ('C', 4, 3), ('C', 5, 5),
    ('C', 6, 2), ('C', 7, 4), ('C', 8, 3), ('C', 9, 4);

DELETE FROM hole_features
WHERE feature_type = 'bunker'
  AND hole_id IN (
      SELECT holes.id
      FROM holes
      JOIN layouts ON layouts.id = holes.layout_id
      JOIN courses ON courses.id = layouts.course_id
      WHERE courses.name = 'Prince Waikiki'
  );

INSERT INTO hole_features (hole_id, feature_type, position)
SELECT holes.id, 'bunker'::hole_feature_type, bunker_number
FROM dev_bunker_counts
JOIN courses ON courses.name = 'Prince Waikiki'
JOIN layouts ON layouts.course_id = courses.id AND layouts.code = dev_bunker_counts.code
JOIN holes ON holes.layout_id = layouts.id AND holes.hole_number = dev_bunker_counts.hole_number
CROSS JOIN LATERAL generate_series(1, dev_bunker_counts.bunkers) AS bunker_number;

COMMIT;

-- Bunkers on each hole now
SELECT layouts.code, holes.hole_number,
       COUNT(hole_features.id) FILTER (WHERE hole_features.feature_type = 'bunker') AS bunkers
FROM holes
JOIN layouts ON layouts.id = holes.layout_id
LEFT JOIN hole_features ON hole_features.hole_id = holes.id
GROUP BY layouts.code, holes.hole_number
ORDER BY layouts.code, holes.hole_number;
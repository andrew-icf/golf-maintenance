-- +goose Up
CREATE TABLE layouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    position INTEGER NOT NULL CHECK (position >= 1),
    front_hole_count INTEGER CHECK (front_hole_count >= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (course_id, name),
    UNIQUE (course_id, position)
);

-- A short code ("A") labels holes ("A4"), so it must be unique within a club when set
CREATE UNIQUE INDEX layouts_course_code_key ON layouts (course_id, code) WHERE code IS NOT NULL;

-- Every existing club gets one layout holding its current holes, so nothing is lost
INSERT INTO layouts (course_id, name, position)
SELECT id, 'Main', 1 FROM courses;

ALTER TABLE holes ADD COLUMN layout_id UUID REFERENCES layouts(id) ON DELETE CASCADE;

UPDATE holes
SET layout_id = layouts.id
FROM layouts
WHERE layouts.course_id = holes.course_id;

ALTER TABLE holes ALTER COLUMN layout_id SET NOT NULL;
ALTER TABLE holes DROP CONSTRAINT IF EXISTS holes_course_id_hole_number_key;
ALTER TABLE holes DROP COLUMN course_id;
ALTER TABLE holes ADD CONSTRAINT holes_layout_id_hole_number_key UNIQUE (layout_id, hole_number);
ALTER TABLE holes ADD CONSTRAINT holes_hole_number_positive CHECK (hole_number >= 1);

-- A comfort station can belong to a hole, for maintenance responsibility.
-- Amenities stay on the club's list either way.
ALTER TABLE amenities ADD COLUMN hole_id UUID REFERENCES holes(id) ON DELETE SET NULL;
CREATE INDEX amenities_hole_id_idx ON amenities (hole_id);

-- +goose Down
-- +goose StatementBegin
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM layouts GROUP BY course_id HAVING COUNT(*) > 1) THEN
        RAISE EXCEPTION 'cannot roll back: a club has more than one layout, and its hole numbers would collide';
    END IF;
END
$$;
-- +goose StatementEnd

DROP INDEX amenities_hole_id_idx;
ALTER TABLE amenities DROP COLUMN hole_id;

ALTER TABLE holes DROP CONSTRAINT holes_hole_number_positive;
ALTER TABLE holes ADD COLUMN course_id UUID REFERENCES courses(id) ON DELETE CASCADE;

UPDATE holes
SET course_id = layouts.course_id
FROM layouts
WHERE layouts.id = holes.layout_id;

ALTER TABLE holes ALTER COLUMN course_id SET NOT NULL;
ALTER TABLE holes DROP COLUMN layout_id;
ALTER TABLE holes ADD CONSTRAINT holes_course_id_hole_number_key UNIQUE (course_id, hole_number);

DROP TABLE layouts;
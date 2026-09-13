-- +goose Up
CREATE TABLE amenities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE amenities;

INSERT INTO amenities (course_id, name, type) VALUES
('90314854-9f63-4080-bc9d-a040120019bf', 'Clubhouse', 'clubhouse'),
('90314854-9f63-4080-bc9d-a040120019bf', 'Driving Range', 'driving_range'),
('90314854-9f63-4080-bc9d-a040120019bf', 'Comfort Station 1', 'comfort_station');
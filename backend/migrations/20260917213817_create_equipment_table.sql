-- +goose Up
CREATE TYPE equipment_status AS ENUM ('working_order', 'needs_repair', 'in_shop');

CREATE TABLE equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    parent_equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL,
    assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    label TEXT NOT NULL,
    status equipment_status NOT NULL DEFAULT 'working_order',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE equipment;
DROP TYPE equipment_status;
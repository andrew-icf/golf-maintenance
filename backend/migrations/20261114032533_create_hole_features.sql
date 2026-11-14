-- +goose Up
CREATE TYPE hole_feature_type AS ENUM (
    'tee_box',
    'par_3_tee_box',
    'fairway',
    'approach',
    'rough',
    'green',
    'bunker'
);

-- One row for each feature of a hole. Everything has exactly one row except bunkers, which are
-- numbered from 1. The constraints are named so a test can tell which one refused something.
CREATE TABLE hole_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hole_id UUID NOT NULL,
    feature_type hole_feature_type NOT NULL,
    position INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT hole_features_hole_id_fkey FOREIGN KEY (hole_id) REFERENCES holes(id) ON DELETE CASCADE,
    CONSTRAINT hole_features_unique_position UNIQUE (hole_id, feature_type, position),
    CONSTRAINT hole_features_position_positive CHECK (position >= 1),
    CONSTRAINT hole_features_one_unless_bunker CHECK (feature_type = 'bunker' OR position = 1)
);

-- The features every hole has exactly one of. Bunkers are not here, since their number varies.
-- This is the only place the list is written down in SQL.
-- +goose StatementBegin
CREATE FUNCTION standard_hole_feature_types() RETURNS hole_feature_type[] AS $$
    SELECT ARRAY['tee_box', 'par_3_tee_box', 'fairway', 'approach', 'rough', 'green']::hole_feature_type[]
$$ LANGUAGE sql IMMUTABLE;
-- +goose StatementEnd

-- Every hole that exists today gets the standard features
INSERT INTO hole_features (hole_id, feature_type)
SELECT holes.id, unnest(standard_hole_feature_types())
FROM holes;

-- And so does every hole created from now on, however it is created, so a hole can never exist
-- without them
-- +goose StatementBegin
CREATE FUNCTION add_standard_hole_features() RETURNS trigger AS $$
BEGIN
    INSERT INTO hole_features (hole_id, feature_type)
    SELECT NEW.id, unnest(standard_hole_feature_types());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

CREATE TRIGGER holes_add_standard_features
AFTER INSERT ON holes
FOR EACH ROW EXECUTE FUNCTION add_standard_hole_features();

-- +goose Down
DROP TRIGGER IF EXISTS holes_add_standard_features ON holes;
DROP FUNCTION IF EXISTS add_standard_hole_features();
DROP TABLE IF EXISTS hole_features;
DROP FUNCTION IF EXISTS standard_hole_feature_types();
DROP TYPE IF EXISTS hole_feature_type;
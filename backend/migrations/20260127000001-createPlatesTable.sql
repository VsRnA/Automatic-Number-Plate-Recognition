CREATE TABLE IF NOT EXISTS plates (
    guid        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number      VARCHAR(20)  NOT NULL,
    region      VARCHAR(10),
    access_type VARCHAR(50)  NOT NULL,
    valid_until TIMESTAMPTZ,
    comment     VARCHAR(255),
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plates_number ON plates (number);

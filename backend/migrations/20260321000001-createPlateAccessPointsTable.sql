CREATE TABLE IF NOT EXISTS "plateAccessPoints" (
    plate_guid UUID NOT NULL REFERENCES plates(guid) ON DELETE CASCADE,
    access_point_id INT NOT NULL REFERENCES "accessPoints"(id) ON DELETE CASCADE,
    PRIMARY KEY (plate_guid, access_point_id)
);

CREATE INDEX IF NOT EXISTS idx_plateAccessPoints_plate ON "plateAccessPoints"(plate_guid);
CREATE INDEX IF NOT EXISTS idx_plateAccessPoints_ap ON "plateAccessPoints"(access_point_id);

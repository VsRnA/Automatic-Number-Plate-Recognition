CREATE TABLE "recognitionHistory" (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "cameraGuid"    UUID         NOT NULL,
    "accessPointId" INT,
    "plateNumber"   VARCHAR(20)  NOT NULL,
    "plateGuid"     UUID,
    confidence      FLOAT        NOT NULL DEFAULT 0,
    "accessGranted" BOOLEAN,
    "snapshotUrl"   VARCHAR(500) NOT NULL DEFAULT '',
    "occurredAt"    TIMESTAMP    NOT NULL,
    "createdAt"     TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recognitionHistory_camera       ON "recognitionHistory" ("cameraGuid");
CREATE INDEX idx_recognitionHistory_plateNumber   ON "recognitionHistory" ("plateNumber");
CREATE INDEX idx_recognitionHistory_occurredAt    ON "recognitionHistory" ("occurredAt");

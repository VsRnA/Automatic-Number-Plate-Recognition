CREATE TABLE "accessPoints" (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description VARCHAR(500) NOT NULL DEFAULT '',
    "isEnabled" BOOLEAN      NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_accessPoints_name UNIQUE (name)
);

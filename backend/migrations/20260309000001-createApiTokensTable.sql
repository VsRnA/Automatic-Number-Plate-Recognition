CREATE TABLE IF NOT EXISTS "api_tokens" (
    "id"          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "token"       VARCHAR(255) NOT NULL UNIQUE,
    "tokenPrefix" VARCHAR(16)  NOT NULL,
    "description" VARCHAR(255) NOT NULL DEFAULT '',
    "isActive"    BOOLEAN      NOT NULL DEFAULT TRUE,
    "lastUsedAt"  TIMESTAMP,
    "createdAt"   TIMESTAMP    NOT NULL DEFAULT NOW()
);

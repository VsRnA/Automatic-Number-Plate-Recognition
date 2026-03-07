-- Create cameras table with full schema
CREATE TABLE IF NOT EXISTS cameras (
    guid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    stream VARCHAR(500) NOT NULL,          -- RTSP URL (SD, для превью)
    "streamHd" VARCHAR(500) NOT NULL,      -- RTSP URL (HD, для распознавания)
    login VARCHAR(100),                    -- Логин для подключения (nullable)
    password VARCHAR(255),                 -- Пароль зашифрованный (nullable)
    "accessPointId" INTEGER,               -- FK к точкам доступа
    "isEnabled" BOOLEAN DEFAULT false,     -- Активна ли камера
    metadata JSONB,                        -- Доп. параметры камеры
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP                  -- Для soft delete
);

-- Create indexes
CREATE INDEX idx_cameras_is_enabled ON cameras("isEnabled");
CREATE INDEX idx_cameras_access_point_id ON cameras("accessPointId");
CREATE INDEX idx_cameras_deleted_at ON cameras("deletedAt");

-- Migration: Rename columns from snake_case to camelCase
-- Table: plates
ALTER TABLE plates RENAME COLUMN access_type TO "accessType";
ALTER TABLE plates RENAME COLUMN valid_until TO "validUntil";
ALTER TABLE plates RENAME COLUMN is_active TO "isActive";
ALTER TABLE plates RENAME COLUMN created_at TO "createdAt";

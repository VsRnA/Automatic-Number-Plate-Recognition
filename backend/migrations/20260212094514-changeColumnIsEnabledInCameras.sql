-- Rename isActive to isEnabled in plates table for consistency
ALTER TABLE plates RENAME COLUMN "isActive" TO "isEnabled";

ALTER TABLE "recognitionHistory"
  ADD COLUMN IF NOT EXISTS "scudResult" JSONB;

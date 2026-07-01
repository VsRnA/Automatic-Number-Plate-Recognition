INSERT INTO plates (guid, number, region, "accessType", "validUntil", comment, "isEnabled", "createdAt")
SELECT gen_random_uuid(), freq."plateNumber", '', 'allowed', NULL,
       'Автоматически добавлен: часто распознаваемый номер', true, NOW()
FROM (
  SELECT "plateNumber", COUNT(*) AS cnt
  FROM "recognitionHistory"
  WHERE "plateNumber" IS NOT NULL AND "plateNumber" <> ''
  GROUP BY "plateNumber"
  HAVING COUNT(*) > 5
) freq
WHERE NOT EXISTS (
  SELECT 1 FROM plates p WHERE p.number = freq."plateNumber"
);

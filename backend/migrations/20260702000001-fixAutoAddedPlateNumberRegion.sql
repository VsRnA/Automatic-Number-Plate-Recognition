-- Номера из частой истории распознавания заносились целиком в поле number (например Y716PT43),
-- а region оставался пустым. Разделяем на number + region по формату ГРЗ: X000XX + 2-3 цифры региона.

DELETE FROM plates wrong
WHERE wrong.comment = 'Автоматически добавлен: часто распознаваемый номер'
  AND COALESCE(wrong.region, '') = ''
  AND wrong.number ~ '^[A-Za-zА-Яа-яЁё]\d{3}[A-Za-zА-Яа-яЁё]{2}\d{2,3}$'
  AND EXISTS (
    SELECT 1
    FROM plates correct
    WHERE correct.guid <> wrong.guid
      AND correct.number = substring(wrong.number from '^([A-Za-zА-Яа-яЁё]\d{3}[A-Za-zА-Яа-яЁё]{2})')
      AND correct.region = substring(wrong.number from '(\d{2,3})$')
  );

UPDATE plates
SET
  number = substring(number from '^([A-Za-zА-Яа-яЁё]\d{3}[A-Za-zА-Яа-яЁё]{2})'),
  region = substring(number from '(\d{2,3})$')
WHERE comment = 'Автоматически добавлен: часто распознаваемый номер'
  AND COALESCE(region, '') = ''
  AND number ~ '^[A-Za-zА-Яа-яЁё]\d{3}[A-Za-zА-Яа-яЁё]{2}\d{2,3}$';

# Python Worker для распознавания номеров

## Архитектура

```
WorkerManager (singleton)
    ↓ создает
WorkerThread (threading.Thread)
    ↓ использует
RecognitionService (YOLO + EasyOCR)
    ↓ отправляет в
RedisProducer (Redis Streams)
```

## Компоненты

### 1. WorkerThread (`src/worker/worker_thread.py`)
- Читает кадры из RTSP потока через OpenCV
- Обрабатывает каждый N-й кадр (по умолчанию каждый 30-й = 1fps @ 30fps)
- Автоматическое переподключение при потере соединения (max 3 попытки)
- Graceful shutdown через threading.Event

### 2. RecognitionService (`src/service/recognition_service.py`)
- Детекция номеров через YOLOv8
- Распознавание текста через EasyOCR
- Нормализация текста (uppercase, alphanumeric)
- Комбинированная уверенность = YOLO confidence × OCR confidence

### 3. ModelLoader (`src/infrastructure/model_loader.py`)
- Singleton с lazy loading моделей
- Thread-safe загрузка через Lock
- YOLO и EasyOCR загружаются только при первом использовании

### 4. RedisProducer (`src/infrastructure/redis_producer.py`)
- Отправка результатов в Redis Streams
- Connection pool для thread-safety
- Stream name: `recognition:results`

### 5. WorkerManager (`src/service/worker_manager.py`)
- Управление воркерами (start/stop)
- Thread-safe операции через Lock
- Shared services (RecognitionService, RedisProducer)

## Конфигурация

В `src/config.py`:

```python
# Worker settings
frame_interval: int = 30              # Обрабатывать каждый 30-й кадр
confidence_threshold: float = 0.7      # Минимальная уверенность
worker_reconnect_delay: int = 5        # Секунды перед retry
worker_max_retries: int = 3            # Максимум попыток переподключения

# Model paths
yolo_model_path: str = "yolov8n.pt"
ocr_languages: list[str] = ["en", "ru"]
ocr_gpu: bool = True
```

## Формат данных Redis Stream

```json
{
  "request_id": "uuid-12345",
  "camera_id": "camera-uuid",
  "timestamp": "2026-02-07T12:34:56Z",
  "plates": [
    {
      "plate_number": "A123BC99",
      "confidence": 0.95,
      "bounding_box": {"x": 100, "y": 200, "width": 150, "height": 50}
    }
  ]
}
```

## Запуск

### Локальное тестирование

1. Установить зависимости:
```bash
cd service-recognition
pip install -r requirements.txt
```

2. Проверить Redis подключение:
```bash
python test_redis.py
```

3. Запустить сервис:
```bash
python -m src.main
```

### Через Docker

```bash
# Production (с TimeWeb S3)
docker-compose up service-recognition

# Локально (с MinIO)
docker-compose -f docker-compose.yml -f docker-compose.local.yml up
```

## Тестирование

### Unit тесты
```bash
pytest tests/
```

### E2E тест

1. Создать камеру через Go backend:
```bash
curl -X POST http://localhost:8080/api/v1/cameras \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Camera",
    "rtspUrl": "rtsp://example.com/stream",
    "isActive": true
  }'
```

2. Проверить Redis Stream:
```bash
redis-cli XREAD COUNT 10 STREAMS recognition:results 0
```

3. Деактивировать камеру:
```bash
curl -X PATCH http://localhost:8080/api/v1/cameras/{id} \
  -H "Content-Type: application/json" \
  -d '{"isActive": false}'
```

## Обработка ошибок

| Ошибка | Поведение |
|--------|-----------|
| RTSP недоступен | Автоматическое переподключение (max 3 попытки) |
| Ошибка обработки кадра | Логирование, продолжение работы |
| Redis недоступен | Fail-soft: логирование, потеря результата |
| ML модели не загружаются | Ошибка при инициализации, воркер не стартует |

## Graceful Shutdown

```python
# Остановка воркера
worker_manager.stop_worker(camera_id)

# Внутри:
# 1. thread.stop() устанавливает Event
# 2. thread.join(timeout=5.0) ждет завершения
# 3. VideoCapture.release() освобождает ресурсы
# 4. Статус обновляется на STOPPED
```

## Потокобезопасность

- `WorkerManager._workers` и `_threads` защищены `threading.Lock`
- `ModelLoader` singleton использует Lock для lazy loading
- `RedisProducer` использует connection pool (thread-safe)
- Каждый WorkerThread работает независимо
- Shared services (RecognitionService, RedisProducer) read-only после инициализации

## Производительность

- **Обработка**: 1 кадр в секунду (frame_interval=30)
- **YOLO inference**: ~50-100ms на CPU, ~10-20ms на GPU
- **EasyOCR**: ~100-200ms на CPU, ~30-50ms на GPU
- **Общее время**: ~150-300ms на кадр

## Потенциальные проблемы

1. **Медленная загрузка YOLO/EasyOCR**
   - Решение: Lazy loading через ModelLoader

2. **Потеря RTSP соединения**
   - Решение: Автоматическое переподключение с retry

3. **Redis недоступен**
   - Решение: Fail-soft (логируем, продолжаем работу)

4. **Высокая нагрузка CPU**
   - Решение: frame_interval=30 (1fps вместо 30fps)

5. **Memory leak при долгой работе**
   - Решение: Тщательный cleanup в finally блоках

## Мониторинг

Логи содержат:
- Старт/остановка воркеров
- Обнаруженные номера с уверенностью
- Время обработки кадра
- Ошибки подключения и обработки
- Статистика Redis отправки

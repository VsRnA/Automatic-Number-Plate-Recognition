# RTSP Stream Troubleshooting

## Проблема

При попытке подключения к RTSP потоку из service-recognition возникает ошибка:
- VLC на других машинах успешно получает поток
- service-recognition в Docker не может открыть поток

## Причины

### 1. Отсутствие FFmpeg
OpenCV использует FFmpeg для декодирования RTSP потоков. Без него `cv2.VideoCapture()` не может работать с RTSP.

### 2. Неправильные параметры OpenCV
По умолчанию OpenCV:
- Использует UDP для RTSP (ненадежно)
- Имеет большой буфер (задержка)
- Короткие таймауты подключения

### 3. Транспортный протокол
RTSP может работать через UDP или TCP:
- **UDP** - быстрее, но ненадежен (потеря пакетов)
- **TCP** - медленнее, но надежнее (используется по умолчанию в VLC)

## Решение

### 1. Установлен FFmpeg в Docker образ
```dockerfile
RUN apt-get install -y \
    ffmpeg \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev
```

### 2. Настроены параметры VideoCapture
```python
cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Минимальная задержка
cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 10000)  # 10 сек таймаут
cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 10000)
```

### 3. Добавлена переменная окружения для TCP транспорта
```yaml
environment:
  - OPENCV_FFMPEG_CAPTURE_OPTIONS=rtsp_transport;tcp
```

## Тестирование

После изменений:

1. Пересоберите Docker образ:
```bash
cd backend
docker-compose build service-recognition
```

2. Запустите контейнеры:
```bash
docker-compose up -d
```

3. Проверьте логи:
```bash
docker-compose logs -f service-recognition
```

4. Создайте камеру с RTSP URL:
```bash
curl -X POST http://localhost:8080/api/v1/cameras \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Camera",
    "rtsp_url": "rtsp://192.168.1.100:8554/stream"
  }'
```

## Формат RTSP URL

```
rtsp://[user:password@]host[:port]/path
```

Примеры:
- `rtsp://192.168.1.100:8554/stream`
- `rtsp://admin:12345@192.168.1.100/stream1`
- `rtsp://camera.local:554/live/main`

## Частые проблемы

### Таймаут подключения
- Проверьте доступность RTSP сервера: `ffmpeg -i rtsp://... -frames:v 1 test.jpg`
- Увеличьте таймауты в коде (по умолчанию 10 сек)

### Потеря кадров
- Уменьшите `frame_interval` (обрабатывать реже)
- Проверьте нагрузку на CPU/GPU

### Codec не поддерживается
- Проверьте кодек: `ffprobe rtsp://...`
- Установите дополнительные кодеки в Dockerfile

## Полезные команды

### Проверка RTSP потока через FFmpeg
```bash
ffmpeg -rtsp_transport tcp -i rtsp://192.168.1.100:8554/stream -frames:v 1 test.jpg
```

### Проверка внутри контейнера
```bash
docker exec -it service-recognition bash
ffmpeg -rtsp_transport tcp -i rtsp://... -frames:v 1 /tmp/test.jpg
```

### Логи OpenCV
```bash
export OPENCV_VIDEOIO_DEBUG=1
```

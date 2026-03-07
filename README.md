# ANPR - Automatic Number Plate Recognition

Система автоматического распознавания номерных знаков.

## Архитектура

```
┌────────────────┐   gRPC (видео)    ┌──────────────────┐
│   Go Backend   │ ────────────────► │  Python Service  │
│   (REST API)   │                   │  (ML + OpenCV)   │
│   port 8080    │ ◄── Redis ─────── │  port 50051      │
└───────┬────────┘    Streams        └────────┬─────────┘
        │                                     │
        ▼                                     ▼
   PostgreSQL                             S3 Storage
```

## Технологии

- **Go Backend**: Gin, GORM, gRPC client, Redis consumer
- **Python Service**: gRPC server, OpenCV, YOLO, EasyOCR
- **Хранилище**: S3
- **Очереди**: Redis Streams
- **БД**: PostgreSQL

## Структура проекта

```
├── backend/              # Go REST API + gRPC клиент
├── service-recognition/  # Python ML сервис
├── proto/                # gRPC proto файлы
└── docs/                 # Документация
```

## Запуск

```bash
docker-compose up
```

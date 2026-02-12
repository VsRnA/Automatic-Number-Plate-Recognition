# Docker Macvlan Configuration for ANPR

## Конфигурация macvlan для прямого доступа к камере

### 1. Создание macvlan сети

```bash
docker network create -d macvlan \
  --subnet=192.169.0.0/24 \
  --gateway=192.169.0.1 \
  --ip-range=192.169.0.128/25 \
  -o parent=en0 \
  anpr_macvlan
```

**Параметры:**
- `--subnet` - ваша локальная подсеть
- `--gateway` - IP роутера
- `--ip-range` - диапазон для Docker (192.169.0.128-254)
- `parent=en0` - сетевой интерфейс (для macOS обычно `en0`)

### 2. Docker Compose с macvlan

```yaml
# docker-compose.macvlan.yml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile
    networks:
      anpr_macvlan:
        ipv4_address: 192.169.0.130
    environment:
      - GRPC_HOST=192.169.0.131  # Прямой IP service-recognition
      - DB_HOST=192.169.0.132
      - REDIS_HOST=192.169.0.133
    restart: unless-stopped

  service-recognition:
    build:
      context: ../service-recognition
      dockerfile: Dockerfile
    networks:
      anpr_macvlan:
        ipv4_address: 192.169.0.131
    environment:
      - GO_BACKEND_HOST=192.169.0.130
      - REDIS_HOST=192.169.0.133
      # Камера напрямую доступна по 192.169.0.103
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    networks:
      anpr_macvlan:
        ipv4_address: 192.169.0.132
    environment:
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASS}
      - POSTGRES_DB=${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    networks:
      anpr_macvlan:
        ipv4_address: 192.169.0.133
    volumes:
      - redis_data:/data
    restart: unless-stopped

networks:
  anpr_macvlan:
    external: true

volumes:
  postgres_data:
  redis_data:
```

### 3. Запуск

```bash
# Создать сеть
docker network create -d macvlan \
  --subnet=192.169.0.0/24 \
  --gateway=192.169.0.1 \
  --ip-range=192.169.0.128/25 \
  -o parent=en0 \
  anpr_macvlan

# Запустить контейнеры
docker-compose -f docker-compose.macvlan.yml up
```

### 4. Доступ с хоста (macOS/Windows)

**Проблема:** С хоста нельзя обратиться к контейнерам в macvlan.

**Решение для Linux:**
```bash
# Создать macvlan интерфейс на хосте
sudo ip link add macvlan-shim link en0 type macvlan mode bridge
sudo ip addr add 192.169.0.129/32 dev macvlan-shim
sudo ip link set macvlan-shim up
sudo ip route add 192.169.0.128/25 dev macvlan-shim
```

**Решение для macOS:**
- Использовать промежуточный контейнер-прокси
- Или оставить bridge сеть для разработки, macvlan для production

## Сравнение с текущей конфигурацией

| Аспект | Bridge (текущая) | Macvlan |
|--------|------------------|---------|
| Доступ к камере | Через extra_hosts | Прямой IP |
| Порты | Нужно пробрасывать | Не нужно |
| Доступ с хоста | Через localhost:8080 | Через IP (требует настройки) |
| Сложность настройки | Простая | Средняя |
| Production ready | ✅ | ✅ |
| Разработка на Mac | ✅ | ⚠️ (ограничения) |

## Рекомендация для ANPR

**Если камера в той же сети (192.169.0.x):**

### Вариант 1: Hybrid (рекомендуется для разработки)
```yaml
# Используйте bridge для разработки
# service-recognition в macvlan для доступа к камере
services:
  backend:
    networks:
      - default  # bridge

  service-recognition:
    networks:
      - default
      - anpr_macvlan  # Для доступа к камере

networks:
  anpr_macvlan:
    driver: macvlan
    driver_opts:
      parent: en0
    ipam:
      config:
        - subnet: 192.169.0.0/24
          gateway: 192.169.0.1
          ip_range: 192.169.0.128/25
```

### Вариант 2: Full macvlan (для production)
- Все сервисы в macvlan
- Требует настройки доступа с хоста

### Вариант 3: Сохранить текущую bridge + extra_hosts
- Проще для разработки
- Работает out-of-the-box на Mac
- Камера доступна через `camera:192.169.0.103`

## Когда использовать macvlan для ANPR:

✅ **Используйте macvlan если:**
- Камера должна стримить напрямую на сервис распознавания
- Нужна минимальная задержка (критично для видео)
- Production deployment на Linux сервере
- Требуется интеграция с существующей сетевой инфраструктурой

❌ **Не используйте macvlan если:**
- Разработка на macOS (ограничения kernel)
- Нет доступа к настройке роутера/DHCP
- Простота setup важнее производительности

## Проверка доступности камеры

```bash
# Из контейнера в macvlan
docker exec service-recognition ping 192.169.0.103

# Проверка стрима с камеры
docker exec service-recognition curl http://192.169.0.103/stream
```

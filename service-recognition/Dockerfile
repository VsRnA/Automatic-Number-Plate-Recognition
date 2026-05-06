FROM python:3.11-slim

WORKDIR /app

# System dependencies for OpenCV, YOLO and RTSP via ffmpeg
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libgl1 \
    ffmpeg \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    && rm -rf /var/lib/apt/lists/*

# Install torch + torchvision CPU-only before other deps to avoid pulling CUDA builds (~2 GB)
# Both must come from the same index to guarantee version compatibility
RUN pip install --no-cache-dir \
    "torch==2.5.1" \
    "torchvision==0.20.1" \
    --index-url https://download.pytorch.org/whl/cpu

# Install remaining Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy ML model weights (обучены заранее, скачивать ничего не нужно)
COPY models/ ./models/

# Copy application code
COPY cmd/ ./cmd/
COPY internal/ ./internal/
COPY infrastructure/ ./infrastructure/

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV YOLO_CONFIG_DIR=/tmp

CMD ["watchmedo", "auto-restart", "--patterns=*.py", "--recursive", "--directory=./internal", "--directory=./infrastructure", "--", "python", "cmd/app/main.py"]

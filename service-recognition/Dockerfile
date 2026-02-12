FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for OpenCV, YOLO, and EasyOCR
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libgl1 \
    wget \
    ffmpeg \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download YOLO model during build
RUN python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

# Copy application code
COPY src/ ./src/

ENV PYTHONUNBUFFERED=1

CMD ["watchmedo", "auto-restart", "--patterns=*.py", "--recursive", "--directory=./src", "--", "python", "-m", "src.main"]

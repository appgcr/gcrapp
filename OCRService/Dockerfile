# ==============================================================================
# GCR Telugu & English OCR Microservice Dockerfile
# Production-ready container with Tesseract 5, Telugu/English traineddata, & OpenCV
# ==============================================================================

FROM python:3.10-slim

# Prevent interactive prompts during package install
ENV DEBIAN_FRONTEND=noninteractive

# Install system libraries for OpenCV, Poppler (PDF rendering), and Tesseract OCR
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-tel \
    poppler-utils \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONUNBUFFERED=1
ENV OCR_HOST=0.0.0.0
ENV OCR_PORT=5002
ENV TESSERACT_CMD=/usr/bin/tesseract
ENV TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata

EXPOSE 5002

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5002/health || exit 1

CMD ["python", "-m", "http.server", "5002"]

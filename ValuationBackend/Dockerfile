# ==============================================================================
# GCR Valuation System — Backend Production Dockerfile
# Production Dockerfile with Node.js 20 LTS, Python 3, LibreOffice & TrueType Fonts
# ==============================================================================

# Build Stage
FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# Production Runner Stage
FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5001

# Install LibreOffice headless (no-GUI), Python 3, python3-docx, and Microsoft-compatible metrics fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer-nogui \
    libreoffice-calc-nogui \
    fonts-liberation \
    fonts-dejavu-core \
    fonts-noto-core \
    python3 \
    python3-docx \
    python3-pip \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Add non-root user for security
RUN groupadd -r gcrgroup && useradd -r -g gcrgroup -m -d /home/gcruser gcruser

# Copy dependencies and application code
COPY --from=builder --chown=gcruser:gcrgroup /app/node_modules ./node_modules
COPY --chown=gcruser:gcrgroup . .

# Create uploads directory and temporary conversions directory with appropriate permissions
RUN mkdir -p /app/uploads /tmp/gcr_conversions && \
    chown -R gcruser:gcrgroup /app/uploads /tmp/gcr_conversions

# Switch to unprivileged user
USER gcruser

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5001/api/health || exit 1

CMD ["node", "server.js"]

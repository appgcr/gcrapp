# ==============================================================================
# GCR Valuation System — React Admin Portal Production Dockerfile
# Multi-stage build: Node.js 20 builder + Nginx Alpine runtime
# ==============================================================================

# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency specifications
COPY package*.json ./
RUN npm ci

# Copy application source
COPY . .

# Build production bundle with Vite
RUN npm run build

# Production Server Stage
FROM nginx:alpine AS runner

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built application from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy optimized nginx configuration
COPY ../deployment/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]

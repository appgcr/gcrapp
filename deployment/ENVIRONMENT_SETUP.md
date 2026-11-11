# GCR Enterprise Environment Setup Guide

This guide details the steps to configure and provision environments for the **GCR Property Valuation Ecosystem** (`ValuationApp`, `ValuationBackend`, `GCRNativeAndroid`, and `OCRService`).

---

## 1. Environment Topology

| Component | Development | Staging | Production |
| :--- | :--- | :--- | :--- |
| **Backend API** | Node.js on `localhost:5001` | Staging Web Service (e.g. Render / AWS) | High-availability Cluster (HTTPS) |
| **Database** | In-Memory / Local Mongo | MongoDB Atlas M0/M10 (Staging DB) | MongoDB Atlas Dedicated (Prod DB) |
| **Admin Portal** | Vite dev on `localhost:5173` | Vercel Staging (`staging-admin...`) | Vercel / Cloudflare Production |
| **Android App** | Debug APK with emulator `10.0.2.2` | QA APK pointing to Staging API | Signed Release APK/AAB for Play Store |
| **OCR Service** | Local Python daemon `localhost:5002`| Isolated Container `ocr-service:5002` | Hardened Container with GPU/Multi-core |
| **File Storage** | Local `./uploads` directory | Cloudinary Staging folder | Cloudinary Production / Private bucket |

---

## 2. Local Development Quickstart

1. **Backend Setup:**
   ```bash
   cd ValuationBackend
   cp .env.development.example .env
   npm install
   npm start
   ```
   *Note: If `MONGODB_URI` is left blank, the backend automatically starts an in-memory MongoDB instance for immediate development.*

2. **Frontend Admin Portal Setup:**
   ```bash
   cd ../ValuationApp
   cp .env.development.example .env
   npm install
   npm run dev
   ```

3. **OCR Engine Setup:**
   ```bash
   cd ../OCRService
   cp .env.development.example .env
   pip install -r requirements.txt
   python ../ValuationBackend/ocr_service/ocr_server.py
   ```

4. **Native Android Setup:**
   ```bash
   cd ../GCRNativeAndroid
   cp local.properties.example local.properties
   cp gradle.properties.example gradle.properties
   ./gradlew assembleDebug
   ```

---

## 3. Staging Deployment

1. Set up a MongoDB Atlas staging database cluster (`gcr_valuation_staging`).
2. Generate staging JWT secrets:
   ```bash
   openssl rand -hex 32
   ```
3. Configure staging environment variables using `ValuationBackend/.env.staging.example`.
4. Deploy the backend and verify health check:
   ```bash
   curl -I https://staging-api.gcrvaluations.com/api/health
   ```
5. Deploy `ValuationApp` with `VITE_API_BASE_URL=https://staging-api.gcrvaluations.com`.

---

## 4. Production Deployment

1. Provision dedicated MongoDB Atlas cluster with VPC peering or IP Access List.
2. Store production secrets inside the cloud provider's Secret Manager (AWS Secrets Manager, GCP Secret Manager, or Render Environment Secrets).
3. **Mandatory Production Checks:**
   - `NODE_ENV=production`
   - `JWT_SECRET` must be cryptographically generated and at least 32 characters.
   - `CORS_ALLOWED_ORIGINS` must only permit verified HTTPS domains.
   - `STORAGE_PROVIDER` configured with secure cloud storage credentials.
   - Centralized validation (`config/env.js`) will abort startup if any required variable or security constraint is violated.

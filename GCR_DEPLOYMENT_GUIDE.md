# GCR — MASTER PRODUCTION DEPLOYMENT & DEVOPS RUNBOOK
**Document ID:** `GCR_DEPLOYMENT_GUIDE.md`  
**Date:** November 4, 2026  
**Role:** Principal DevOps Architect, Cloud Reliability Engineer, and Cybersecurity Lead  
**Target Environments:** Staging / Production  

---

## 1. Architecture Overview

The production deployment of GCR consists of four decoupled services:
1. **Core Backend API (`ValuationBackend`):** Node.js 20+ Express API service, managed via PM2 or Docker.
2. **Database Cluster (`MongoDB Atlas`):** M30+ replica set in an Indian region (e.g., Mumbai `ap-south-1`) with automated point-in-time recovery.
3. **OCR Processing Engine (`OCRService`):** Dedicated Python container with Tesseract English + Telugu language models.
4. **Super Admin Web Portal (`ValuationApp`):** Minified React SPA served via NGINX with TLS 1.3 or Amazon CloudFront.
5. **Native Android Engineer Application (`GCRNativeAndroid`):** Compiled native APK distributed via internal enterprise MDM or Google Play Private App Store.

---

## 2. Environment Configuration

Production environments must never share secrets with development. Create `/etc/gcr/backend.env` with restricted permissions (`chmod 600`):

```ini
NODE_ENV=production
PORT=5001
MONGODB_URI=mongodb+srv://gcr_prod_app:<DB_PASSWORD>@<your-cluster>.mongodb.net/gcr_valuation_prod?retryWrites=true&w=majority
JWT_SECRET=<64_BYTE_CRYPTOGRAPHICALLY_RANDOM_SECRET>
CORS_ORIGIN=https://admin.gcrvaluations.com

# Archival Cryptographic Keyring Configuration
ARCHIVE_SIGNING_KEY_ID=gcr-2026-k1
ARCHIVE_SIGNING_KEY=<32_BYTE_HEX_ACTIVE_KEY>
ARCHIVE_KEYRING={"gcr-2025-k0":"<HISTORICAL_HEX_SECRET>"}

# Storage Paths
PERSISTENT_STORAGE_PATH=/var/data/gcr/uploads
MAX_FILE_SIZE_BYTES=52428800

# OCR Microservice Endpoint
OCR_SERVICE_URL=http://127.0.0.1:8000
```

---

## 3. Core Backend Deployment

### Option A: Systemd & PM2
1. Install Node.js 20 LTS:
   ```bash
   npm install -g pm2
   ```
2. Deploy backend artifacts:
   ```bash
   cd /var/www/gcr/ValuationBackend
   npm ci --production
   ```
3. Start PM2 cluster process:
   ```bash
   pm2 start server.js --name "gcr-backend" -i max --env /etc/gcr/backend.env
   pm2 save
   pm2 startup
   ```

### Option B: Docker Containerization
Using [`ValuationBackend/Dockerfile`](file:///Users/apple/GCR%20/gcrapp/ValuationBackend/Dockerfile):
```bash
docker build -t gcr-backend:latest ./ValuationBackend
docker run -d \
  --name gcr-backend \
  --restart always \
  --env-file /etc/gcr/backend.env \
  -p 5001:5001 \
  -v /var/data/gcr/uploads:/app/uploads \
  gcr-backend:latest
```

---

## 4. OCR Microservice Deployment

Using [`OCRService/Dockerfile`](file:///Users/apple/GCR%20/gcrapp/OCRService/Dockerfile):
```bash
docker build -t gcr-ocr-service:latest ./OCRService
docker run -d \
  --name gcr-ocr-service \
  --restart always \
  -p 8000:8000 \
  gcr-ocr-service:latest
```

---

## 5. Super Admin Web Portal Deployment

1. Build production static bundle:
   ```bash
   cd ValuationApp
   VITE_API_URL=https://api.gcrvaluations.com/api npm run build
   ```
2. Copy `dist/` contents to NGINX web root:
   ```bash
   cp -r dist/* /var/www/gcr-admin/
   ```
3. Configure NGINX reverse proxy with TLS 1.3:
   ```nginx
   server {
       listen 443 ssl http2;
       server_name admin.gcrvaluations.com;

       ssl_certificate /etc/letsencrypt/live/admin.gcrvaluations.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/admin.gcrvaluations.com/privkey.pem;

       root /var/www/gcr-admin;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }

       location /api/ {
           proxy_pass http://127.0.0.1:5001/api/;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto https;
       }
   }
   ```

---

## 6. Native Android Engineer App Installation & Distribution

### 6.1 Direct ADB Installation (Field Testing / QA)
```bash
adb install -r GCRNativeAndroid/app/build/outputs/apk/debug/app-debug.apk
```

### 6.2 Production Release Signing (Enterprise Keystore)
1. Sign unsigned release APK with production keystore:
   ```bash
   apksigner sign \
     --ks /etc/gcr/release.keystore \
     --ks-key-alias gcr_release_key \
     --out GCR_Field_Engineer_v1.0_Signed.apk \
     GCRNativeAndroid/app/build/outputs/apk/release/app-release-unsigned.apk
   ```
2. Verify signature compliance:
   ```bash
   apksigner verify --verbose GCR_Field_Engineer_v1.0_Signed.apk
   ```

---

## 7. Database Indexes & Maintenance

Execute in MongoDB Atlas production shell to verify indexing performance:
```javascript
use gcr_valuation_prod;

// Valuation Case Indexes
db.valuationcases.createIndex({ caseId: 1 }, { unique: true });
db.valuationcases.createIndex({ assignedEngineerId: 1, status: 1 });
db.valuationcases.createIndex({ status: 1, createdAt: -1 });

// Report Archive Cryptographic Indexes
db.reportarchives.createIndex({ caseId: 1, version: 1 }, { unique: true });
db.reportarchives.createIndex({ keyId: 1 });

// Attendance Anti-Duplicate Index
db.attendances.createIndex({ userId: 1, date: 1, type: 1 }, { unique: true });
```

---

## 8. Backup & Disaster Recovery Runbook

### 8.1 Automated Nightly Backup Script
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/gcr/$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"

# 1. Backup MongoDB metadata
mongodump --uri="$MONGODB_URI" --gzip --out="$BACKUP_DIR/mongo"

# 2. Sync report binaries and manifests
rsync -avz /var/data/gcr/uploads/ "$BACKUP_DIR/uploads/"

# 3. Encrypt backup archive with GPG
tar -czf - "$BACKUP_DIR" | gpg -c --batch --passphrase="$BACKUP_PASSPHRASE" > "$BACKUP_DIR.tar.gz.enc"
```

### 8.2 Disaster Recovery Restoration
```bash
# 1. Restore MongoDB
mongorestore --uri="$MONGODB_URI" --gzip --drop /var/backups/gcr/recovery/mongo/

# 2. Restore persistent volume binaries
rsync -avz /var/backups/gcr/recovery/uploads/ /var/data/gcr/uploads/

# 3. Run archival verification regression
node ValuationBackend/tests/test_phase_3_5_5_2_remediation.js
```

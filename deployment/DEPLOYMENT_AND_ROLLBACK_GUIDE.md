# GCR Valuation System — Deployment, Monitoring & Rollback Guide

**Document Version:** 1.0.0  
**Effective Date:** November 1, 2026  
**Audience:** DevOps Engineers, System Administrators, Lead Developers  
**Scope:** Staging and Production Deployments across Web, Backend, OCR, and Android  

---

## 1. System Architecture Overview

```mermaid
graph TD
    User([Clients / Banks / Field Engineers]) --> Cloudflare[Cloudflare CDN & WAF / SSL]
    Cloudflare --> Ingress[Nginx Reverse Proxy :443]
    
    subgraph Staging/Production Host
        Ingress -->|/api/*| Backend[ValuationBackend Node.js :5001]
        Ingress -->|/* (Static)| Frontend[ValuationApp Nginx SPA :80]
        Backend -->|Internal REST| OCR[OCRService Python Engine :5002]
        Backend -->|Persistent Pool| Atlas[(MongoDB Atlas Cluster)]
    end
    
    Android[GCR Native Android App] -->|HTTPS Strict| Cloudflare
```

---

## 2. Pre-Deployment Staging Checklist

Before triggering a deployment to staging or production, execute these mandatory validation checks:

| # | Verification Step | Command / Evidence | Status Required |
| :-: | :--- | :--- | :-: |
| 1 | **Environment Schema Validation** | `node tests/env_validation.test.js` | 10/10 Passed (100%) |
| 2 | **Database Readiness Test** | `node tests/mongodb_staging_readiness.test.js` | 4/4 Passed (100%) |
| 3 | **OCR Logic & Fault Tolerance** | `node tests/ocr_staging_validation.test.js` | 4/4 Passed (100%) |
| 4 | **Full Workflow & Role Auth** | `node tests/e2e_workflow.test.js` | 47/47 Passed (100%) |
| 5 | **React Production Build** | `npm run build` in `ValuationApp/` | Exit Code 0 |
| 6 | **Android Security Test Suite** | `./gradlew testDebugUnitTest` | 0 Failures |
| 7 | **Android Production APK Build** | `./gradlew assembleRelease` | Unbundled secrets = 0 |

---

## 3. Staging Deployment Execution

### Step 1: Environment File Population
Ensure `.env.staging` is created from the validated template:
```bash
cp deployment/.env.staging.example deployment/.env.staging
# Inject verified staging MONGODB_URI and JWT_SECRET
chmod 600 deployment/.env.staging
```

### Step 2: Build & Start Container Services
From the `deployment/` directory:
```bash
cd deployment

# Build containers with no-cache to guarantee fresh layers
docker compose -f docker-compose.staging.yml build --no-cache

# Launch in detached mode
docker compose -f docker-compose.staging.yml up -d
```

### Step 3: Verify Container Health Checks
```bash
docker compose -f docker-compose.staging.yml ps
```
All containers (`gcr-backend-staging`, `gcr-ocr-staging`, `gcr-frontend-staging`) must show `healthy`.

### Step 4: Run Post-Deployment Smoke Test
```bash
# 1. Test Backend Health Check
curl -f https://staging-api.gcrvaluations.com/api/health

# 2. Test Frontend Static Asset Delivery
curl -I https://staging.gcrvaluations.com/healthz

# 3. Test OCR Microservice Health
curl -f http://localhost:5002/health
```

---

## 4. Production Deployment & Zero-Downtime Blue/Green Strategy

For production, zero-downtime cutover is achieved using blue/green container deployments or AWS ECS / Render rolling updates:

```
[ Active Traffic ] ───> [ Blue Stack (Current) ]
                                 │
                   (Deploy New)  ▼
                        [ Green Stack (New v2.0) ]
                                 │
                   (Health Pass) ▼
[ Active Traffic ] ───> [ Green Stack (New v2.0) ]  (Cutover in < 1s)
                        [ Blue Stack (Standby for rollback) ]
```

1. Deploy new version to the idle container target (Green).
2. Wait for `GET /api/health` to return HTTP 200 with `database: "Connected to MongoDB Database"`.
3. Shift Nginx / Load Balancer upstream proxy to Green.
4. Keep Blue container running for 30 minutes. If error rate rises, switch upstream back immediately.

---

## 5. Rollback Procedures

### Trigger Conditions for Rollback
Initiate an immediate rollback if ANY of the following occur within 30 minutes of deployment:
1. `GET /api/health` returns HTTP 503 or fails 3 consecutive health probes.
2. HTTP 5xx error rate exceeds 1% of total requests.
3. Mobile app reports authentication failure spikes.
4. Database latency spikes above 2000ms.

### Immediate Container Rollback
```bash
# Option A: Fast rollback with Docker Compose (revert to previous tag)
docker compose -f docker-compose.staging.yml stop
docker tag gcr-backend:previous gcr-backend:latest
docker compose -f docker-compose.staging.yml up -d --no-build

# Option B: Git Revert Rollback
git revert HEAD --no-edit
docker compose -f docker-compose.staging.yml build
docker compose -f docker-compose.staging.yml up -d
```

### Database Rollback
If a deployment involved corrupted data or failed migrations, refer directly to [`deployment/BACKUP_AND_RESTORE_PROCEDURES.md`](file:///Users/apple/GCR%20/gcrapp/deployment/BACKUP_AND_RESTORE_PROCEDURES.md) to restore from the pre-deployment snapshot.

---

## 6. Logging, Monitoring & Alerting

### Log Aggregation
- **Backend Application Logs:** Written to standard output and parsed by Docker logging driver (`json-file` with `max-size: 50m`, `max-file: 5`).
- **Structured Error Logging:** Handled via Winston with correlation IDs on every HTTP request.
- **Access Logs:** Managed by Nginx with client IP, request time, status code, and upstream response time.

### Monitoring Metrics to Watch
1. **Host CPU & Memory:** Threshold: CPU > 80% for 5 mins &rarr; Auto-scale / Alert.
2. **MongoDB Connection Pool:** Monitored via Atlas metrics (Connections, Disk IOPS, Query latency).
3. **HTTP Status Code Ratio:** 2xx > 99%, 4xx < 1%, 5xx = 0%.

### Emergency Escalation Matrix
| Level | Severity | Incident Example | Notification Channel | Response SLA |
| :-: | :--- | :--- | :--- | :--- |
| **P1** | **CRITICAL** | Production backend offline, database unreachable | PagerDuty / Phone Call | < 15 Minutes |
| **P2** | **HIGH** | OCR engine down, mobile sync delayed | Slack #gcr-alerts | < 30 Minutes |
| **P3** | **MEDIUM** | Non-critical frontend UI glitch, slow PDF download | Slack #gcr-dev | < 4 Hours |
| **P4** | **LOW** | Minor styling inconsistency, documentation update | Jira / GitHub Issue | Next Sprint |

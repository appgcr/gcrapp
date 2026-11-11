# GCR Enterprise Environment Master Architecture Guide

**System Name:** GCR Property Valuation Management Ecosystem  
**Target Panel:** State Bank of India (SBI) Panel Valuer Tech Portal  
**Components:**
- `ValuationApp`: React 19 / Vite 5 Web Admin Portal
- `ValuationBackend`: Node.js 24 / Express 4 / MongoDB Atlas API
- `GCRNativeAndroid`: 100% Pure Native Android (Kotlin / Jetpack Compose)
- `OCRService`: Local High-Accuracy Python OCR Microservice (Telugu & English)
- `deployment`: Unified multi-environment deployment orchestration

---

## 1. Environment Architecture & File Topology

```
gcrapp/
│
├── ValuationApp/                                # React 19 / Vite Admin Portal
│   ├── .env.example                            # Master frontend template
│   ├── .env.development.example                # Local dev frontend template
│   ├── .env.production.example                 # Production frontend template
│   └── src/config/api.js                       # Centralized API endpoint resolver
│
├── ValuationBackend/                            # Node.js 24 / Express API
│   ├── .env.example                            # Master backend template
│   ├── .env.development.example                # Local dev template (zero-cost fallbacks)
│   ├── .env.staging.example                    # QA/Staging template
│   ├── .env.production.example                 # Production high-security template
│   │
│   ├── config/
│   │   ├── env.schema.js                       # Comprehensive schema constraints & rules
│   │   ├── env.js                              # Centralized startup validator (No secret leakage)
│   │   └── services.js                         # Optional service factory (Cloudinary, FCM, Gemini)
│   │
│   ├── ocr_service/                            # In-tree Python OCR engine
│   │   ├── .env.example                        # In-tree OCR template
│   │   ├── ocr_engine.py                       # Preprocessing & text detection
│   │   └── ocr_server.py                       # Local HTTP microservice daemon (Port 5002)
│   │
│   └── tests/
│       └── env_validation.test.js              # Automated 10-point environment test suite
│
├── OCRService/                                  # Standalone Python OCR Container
│   ├── .env.example                            # Standalone OCR template
│   ├── .env.development.example
│   ├── .env.production.example
│   ├── requirements.txt                        # Python dependencies
│   └── config/
│       └── settings.py                         # OCR environment loader
│
├── GCRNativeAndroid/                            # Pure Native Android Mobile App
│   ├── local.properties.example                # Local developer SDK configuration
│   ├── gradle.properties.example               # Android build-time properties & flags
│   └── app/src/main/assets/
│       ├── app-config.example.json             # Mobile runtime configuration template
│       ├── app-config.development.json         # Development mobile config (10.0.2.2:5001)
│       ├── app-config.staging.json             # Staging mobile config
│       └── app-config.production.json          # Production mobile config (HTTPS only)
│
├── deployment/                                  # Deployment Configurations
│   ├── .env.staging.example                    # Unified staging template
│   ├── .env.production.example                 # Unified production template
│   ├── ENVIRONMENT_SETUP.md                    # Environment provisioning guide
│   └── FREE_API_RECOMMENDATION_REPORT.md       # Cost-effective & free tier evaluation
│
├── .gitignore                                  # Enterprise secret exclusion rules
├── ENVIRONMENT_MASTER_GUIDE.md                 # This Master Guide
└── ENVIRONMENT_CREDENTIAL_CHECKLIST.md         # Hand-off credential checklist
```

---

## 2. Environment Variables Inventory & Classification

### A. Backend Variables (`ValuationBackend`)

| Variable Name | Required? | Secret / Public | Default Value | Purpose | Where to Obtain |
| :--- | :---: | :---: | :--- | :--- | :--- |
| `NODE_ENV` | **Required** | Public | `development` | Environment mode (`development`, `staging`, `production`) | System environment |
| `PORT` | Optional | Public | `5001` | TCP listener port | Server config |
| `HOST` | Optional | Public | `0.0.0.0` | Bind host address | Server config |
| `MONGODB_URI` | **Required (Prod/Staging)** | **Secret** | In-memory fallback (Dev) | MongoDB Atlas connection string | [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) |
| `JWT_SECRET` | **Required (Prod/Staging)** | **Secret** | Auto dev key (Dev) | Cryptographic signing key for access tokens (min 32 chars) | `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | Optional | Public | `15m` | Lifetime of access token | Backend config |
| `JWT_REFRESH_SECRET` | Optional | **Secret** | Auto dev key (Dev) | Cryptographic signing key for refresh tokens | `openssl rand -hex 32` |
| `JWT_REFRESH_EXPIRES_IN`| Optional | Public | `7d` | Lifetime of refresh token | Backend config |
| `ENCRYPTION_KEY` | **Required (Prod)** | **Secret** | None | 32-byte AES key for field-level database encryption | `openssl rand -hex 32` |
| `CORS_ALLOWED_ORIGINS` | **Required (Prod)** | Public | `http://localhost:5173` | Comma-separated whitelist of frontend domains | Domain DNS |
| `STORAGE_PROVIDER` | Optional | Public | `local` | Document storage engine (`local` or `cloudinary`) | Architecture choice |
| `CLOUDINARY_CLOUD_NAME`| Required if Cloudinary | Public | None | Cloudinary cloud account name | [Cloudinary Console](https://cloudinary.com) |
| `CLOUDINARY_API_KEY` | Required if Cloudinary | Public | None | Cloudinary API Key | [Cloudinary Console](https://cloudinary.com) |
| `CLOUDINARY_API_SECRET`| Required if Cloudinary | **Secret** | None | Cloudinary API Secret | [Cloudinary Console](https://cloudinary.com) |
| `OCR_ENABLED` | Optional | Public | `true` | Toggle for document OCR extraction | Backend config |
| `OCR_SERVICE_URL` | Optional | Public | `http://127.0.0.1:5002`| REST endpoint for Python OCR microservice | Internal network |
| `OCR_LANGUAGE` | Optional | Public | `eng+tel` | Languages for document recognition (English + Telugu) | OCR models |
| `GEMINI_ENABLED` | Optional | Public | `false` | Enable Google Gemini AI vision fallback | System feature flag |
| `GEMINI_API_KEY` | Required if Gemini | **Secret** | None | Google AI Studio API key | [Google AI Studio](https://aistudio.google.com/) |
| `GEMINI_MODEL` | Optional | Public | `gemini-1.5-flash` | Gemini model identifier | Google AI Docs |
| `FCM_ENABLED` | Optional | Public | `false` | Enable Firebase Cloud Messaging push alerts | System feature flag |
| `FCM_PROJECT_ID` | Required if FCM | Public | None | Firebase project ID | [Firebase Console](https://console.firebase.google.com/) |
| `FCM_SERVICE_ACCOUNT_PATH`| Required if FCM | **Secret** | None | Path to service account private key JSON file | Firebase Service Accounts |
| `EMAIL_ENABLED` | Optional | Public | `false` | Enable SMTP email dispatch | System feature flag |
| `SMTP_HOST` | Required if Email | Public | None | Outgoing SMTP server address | Email service provider |
| `SMTP_PORT` | Required if Email | Public | `587` | Outgoing SMTP port (587 or 465) | Email service provider |
| `SMTP_USERNAME` | Required if Email | Public | None | SMTP authentication username | Email service provider |
| `SMTP_PASSWORD` | Required if Email | **Secret** | None | SMTP authentication password / App Password | Email service provider |
| `EMAIL_FROM` | Required if Email | Public | None | Verified sender email header | Email service provider |
| `SENTRY_DSN` | Optional | **Secret** | None | Sentry project DSN for backend error capture | [Sentry.io](https://sentry.io/) |

---

### B. Frontend Variables (`ValuationApp`)

> [!WARNING]
> All `VITE_*` variables are statically injected into JavaScript bundles and readable by client browsers. Never place database passwords, private keys, or JWT signing secrets in frontend configuration.

| Variable Name | Required? | Secret / Public | Default Value | Purpose |
| :--- | :---: | :---: | :--- | :--- |
| `VITE_APP_NAME` | Optional | Public | `GCR Valuation Admin Portal` | UI title bar branding |
| `VITE_APP_ENV` | Optional | Public | `development` | Frontend runtime indicator |
| `VITE_API_BASE_URL` | **Required** | Public | `http://localhost:5001` | Backend REST API base URL |
| `VITE_API_URL` | **Required** | Public | `http://localhost:5001` | Alternate name for backend base URL |
| `VITE_ENABLE_MAP` | Optional | Public | `true` | Enable interactive property map |
| `VITE_MAP_PROVIDER` | Optional | Public | `osm` | Map tile provider (`osm` = OpenStreetMap) |
| `VITE_SENTRY_DSN` | Optional | Public | None | Sentry frontend error logging DSN |

---

### C. Native Android Variables (`GCRNativeAndroid`)

The Native Android app uses a clean, two-layer configuration strategy:
1. **Build Time:** `gradle.properties` / `local.properties` for developer machine settings.
2. **Runtime:** `app-config.json` inside assets (`app/src/main/assets/`) which is securely read by `TokenManager.kt`.

| Config Key | Required? | Secret / Public | Default Value | Purpose |
| :--- | :---: | :---: | :--- | :--- |
| `appEnvironment` | Optional | Public | `development` | Target environment (`development`, `staging`, `production`) |
| `apiBaseUrl` | **Required** | Public | `http://10.0.2.2:5001/` | Backend REST API URL (requires trailing slash for Retrofit) |
| `enableLogging` | Optional | Public | `true` (debug) / `false` (prod) | HTTP request/response body logging |
| `enableOfflineMode` | Optional | Public | `true` | Offline Room database caching & sync |
| `enableGps` | Optional | Public | `true` | Geofenced biometric attendance & photo stamping |
| `enableCamera` | Optional | Public | `true` | CameraX property photograph acquisition |
| `enableNotifications` | Optional | Public | `false` | Firebase Cloud Messaging push client |
| `mapProvider` | Optional | Public | `osm` | Map tile layer |

---

## 3. Centralized Environment Validator Architecture

The backend implements automated, centralized environment validation (`ValuationBackend/config/env.js`) executed at server startup.

### Security Guarantees:
1. **Zero Secret Leakage:** When validation fails, the system outputs **variable NAMES only**, never printing connection strings or token values.
2. **Graceful Degradation:** If optional services (`GEMINI_ENABLED=false`, `FCM_ENABLED=false`, `EMAIL_ENABLED=false`, `STORAGE_PROVIDER=local`) are disabled, the system boots without requiring external credentials.
3. **Strict Production Enforcement:** In `NODE_ENV=production`:
   - `JWT_SECRET` must be cryptographically secure and at least 32 characters.
   - Default/dev secrets are explicitly rejected.
   - `CORS_ALLOWED_ORIGINS` must only allow secure `https://` origins.
   - `MONGODB_URI` must be a valid MongoDB connection string.

---

## 4. Secret Generation & Rotation Guide

### Generating Cryptographic Secrets
Run the following terminal commands to generate enterprise-grade secrets:

```bash
# 1. Generate Production JWT Secret (32-byte hex)
openssl rand -hex 32

# 2. Generate Production JWT Refresh Secret (32-byte hex)
openssl rand -hex 32

# 3. Generate AES-256 Database Encryption Key (32-byte hex)
openssl rand -hex 32
```

### Secret Rotation Procedure:
1. **Zero-Downtime JWT Secret Rotation:**
   - Update `JWT_REFRESH_SECRET` first.
   - Deploy backend. Active sessions will re-authenticate upon access token expiration (15m).
2. **MongoDB Credential Rotation:**
   - In MongoDB Atlas, create a new database user.
   - Update `MONGODB_URI` in cloud secrets.
   - Verify connection on staging before cutting over production.
   - Delete the old MongoDB user once verified.

---

## 5. Security Warnings & Git Hygiene

> [!CAUTION]
> **Strict Operational Security Mandates:**
> - Never commit `.env`, `.env.local`, or any file containing real API keys to Git.
> - Keystores (`*.jks`, `*.keystore`) and Firebase service accounts (`serviceAccountKey*.json`) must be stored in secure CI/CD vaults (e.g. GitHub Actions Secrets, AWS Secrets Manager).
> - Never transmit confidential borrower identity documents or bank sale deeds over Google Gemini Free Tier, as free-tier inputs may be logged for model training.

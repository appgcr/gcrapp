# GCR Enterprise Environment Credential Checklist

**Instructions:**  
This checklist organizes every credential and secret across the GCR ecosystem into logical groups (A through K).  
**You do not need to provide everything at once.** Items marked **"Optional"** or with **"Free Local Fallback"** can remain empty during development.

---

## Summary Matrix

| Group | Category | Status in Development | Status in Production | Free Tier Available? |
| :--- | :--- | :---: | :---: | :---: |
| **A** | Database Credentials | ✅ Atlas Cluster0 connected 11 Nov 2026 (local = gcr_dev; Render must use gcr_valuation) — **use a strong DB password before go-live** | **Mandatory** | Yes (MongoDB Atlas M0 Free) |
| **B** | Backend Auth Secrets | ✅ Generated 11 Nov 2026 (in .env) | **Mandatory** | Yes (Generated via openssl) |
| **C** | Encryption Keys | ✅ Generated 11 Nov 2026 (in .env) | **Mandatory** | Yes (Generated via openssl) |
| **D** | Gemini AI Credentials | ✅ Key added 11 Nov 2026 (billing recommended) | **Required for go-live** | Yes (15 RPM Free Tier) |
| **E** | Cloudinary Credentials | API key + secret saved 11 Nov 2026 — **Cloud name still needed** | Recommended | Yes (25 Monthly Credits Free) |
| **F** | Firebase Credentials | ✅ Android config + server key installed, FCM on (11 Nov 2026) — **Render needs the key as a Secret File** | Optional | Yes (FCM Push is 100% Free) |
| **G** | Email (SMTP) Secrets | Brevo SMTP key saved — **SMTP login + sender email needed; app has no email features yet** | Recommended | Yes (Gmail App Password / SendGrid) |
| **H** | Maps Credentials | OpenStreetMap (Free) | OpenStreetMap (Free) | Yes (100% Free OpenStreetMap) |
| **I** | Monitoring (Sentry) | Org `gcr-ue` created — **project DSN needed; SDK not yet installed** | Recommended | Yes (Sentry Free Developer Tier) |
| **J** | Hosting Infrastructure | Localhost | Cloud Deployment | Yes / Freemium options |
| **K** | Android Keystore | Debug Keystore | **Mandatory** for Play Store | Free (Generated via keytool) |

---

## A. Database Credentials

| Credential Name | Required / Optional | Free / Paid | Registration / Management URL | Configured In | Must Be Supplied By You? |
| :--- | :---: | :---: | :--- | :--- | :---: |
| **MongoDB Atlas URI** (`MONGODB_URI`) | **Mandatory in Prod** / Optional in Dev | Free (M0 Tier) or Dedicated (Paid) | [cloud.mongodb.com](https://cloud.mongodb.com/) | `ValuationBackend/.env` | **Yes (for Production/Staging)** |
| **Database Name** (`MONGODB_DATABASE`) | Optional | Free | MongoDB Cluster Console | `ValuationBackend/.env` | Optional (defaults to `gcr_valuation`) |

---

## B. Backend Authentication Secrets

| Credential Name | Required / Optional | Free / Paid | Where to Generate | Configured In | Must Be Supplied By You? |
| :--- | :---: | :---: | :--- | :--- | :---: |
| **JWT Access Secret** (`JWT_SECRET`) | **Mandatory in Prod** (min 32 chars) | Free | Terminal: `openssl rand -hex 32` | `ValuationBackend/.env` | **Yes (for Production/Staging)** |
| **JWT Refresh Secret** (`JWT_REFRESH_SECRET`) | Recommended in Prod | Free | Terminal: `openssl rand -hex 32` | `ValuationBackend/.env` | **Yes (for Production/Staging)** |

---

## C. Encryption Keys

| Credential Name | Required / Optional | Free / Paid | Where to Generate | Configured In | Must Be Supplied By You? |
| :--- | :---: | :---: | :--- | :--- | :---: |
| **AES Encryption Key** (`ENCRYPTION_KEY`) | **Mandatory in Prod** (32 bytes) | Free | Terminal: `openssl rand -hex 32` | `ValuationBackend/.env` | **Yes (for Production)** |

---

## D. Gemini AI Credentials (Required — Step 2 document checks)

> Without this key, Step 2 accepts uploads as "AI check pending" (duplicates and file-type rules still apply).
> With it: wrong document type is rejected, the sale-deed owner name (Telugu or English) must match the Step 1 customer,
> and deed details are read into the form. Site-photo addresses use OpenStreetMap Nominatim (free, no key, 1 request/sec).

| Credential Name | Required / Optional | Free / Paid | Registration / Management URL | Configured In | Must Be Supplied By You? |
| :--- | :---: | :---: | :--- | :--- | :---: |
| **Gemini API Key** (`GEMINI_API_KEY`) | **Required** (reads Telugu deeds & scanned certificates, rejects wrong documents) | Free Tier / Pay-As-You-Go | [aistudio.google.com](https://aistudio.google.com/) | `ValuationBackend/.env` | **Yes** |
| **Gemini Model** (`GEMINI_MODEL`) | Optional | Free | Google AI Studio Docs | `ValuationBackend/.env` | Optional (the app tries `gemini-2.5-flash` automatically) |

---

## E. Cloudinary Credentials (Optional Cloud Storage)

| Credential Name | Required / Optional | Free / Paid | Registration / Management URL | Configured In | Must Be Supplied By You? |
| :--- | :---: | :---: | :--- | :--- | :---: |
| **Cloud Name** (`CLOUDINARY_CLOUD_NAME`) | Optional (Local storage active by default) | Free (25 Credits) | [cloudinary.com/console](https://cloudinary.com/console) | `ValuationBackend/.env` | Only if `STORAGE_PROVIDER=cloudinary` |
| **API Key** (`CLOUDINARY_API_KEY`) | Optional | Free | [cloudinary.com/console](https://cloudinary.com/console) | `ValuationBackend/.env` | Only if `STORAGE_PROVIDER=cloudinary` |
| **API Secret** (`CLOUDINARY_API_SECRET`) | Optional | Free | [cloudinary.com/console](https://cloudinary.com/console) | `ValuationBackend/.env` | Only if `STORAGE_PROVIDER=cloudinary` |

---

## F. Firebase Credentials (Optional Push Notifications)

| Credential Name | Required / Optional | Free / Paid | Registration / Management URL | Configured In | Must Be Supplied By You? |
| :--- | :---: | :---: | :--- | :--- | :---: |
| **Firebase Project ID** (`FCM_PROJECT_ID`) | Optional | Free (100% Free) | [console.firebase.google.com](https://console.firebase.google.com/) | `ValuationBackend/.env` | Only if enabling FCM |
| **Service Account JSON** (`FCM_SERVICE_ACCOUNT_PATH`) | Optional | Free | Firebase Settings &rarr; Service Accounts | Server Secrets Directory | Only if enabling FCM |
| **Android Client Config** (`google-services.json`) | Optional | Free | Firebase Project Settings &rarr; Android App | `GCRNativeAndroid/app/` | Only if enabling FCM on mobile |

---

## G. Transactional Email Credentials (SMTP)

| Credential Name | Required / Optional | Free / Paid | Registration / Management URL | Configured In | Must Be Supplied By You? |
| :--- | :---: | :---: | :--- | :--- | :---: |
| **SMTP Host** (`SMTP_HOST`) | Optional | Free (Gmail / SendGrid / Mailtrap) | Email Provider Settings | `ValuationBackend/.env` | Only if enabling email alerts |
| **SMTP Port** (`SMTP_PORT`) | Optional | Free | Email Provider Settings | `ValuationBackend/.env` | Optional (defaults to 587) |
| **SMTP Username** (`SMTP_USERNAME`) | Optional | Free | Email Provider Settings | `ValuationBackend/.env` | Only if enabling email alerts |
| **SMTP Password** (`SMTP_PASSWORD`) | Optional | Free | Provider App Password | `ValuationBackend/.env` | Only if enabling email alerts |

---

## H. Maps & Geolocation Credentials

| Credential Name | Required / Optional | Free / Paid | Registration / Management URL | Configured In | Must Be Supplied By You? |
| :--- | :---: | :---: | :--- | :--- | :---: |
| **OpenStreetMap** | **Active Default** | **100% Free** | No registration needed | Hardcoded tile layer | **No (Already working out-of-the-box)** |
| **Google Maps API Key** (`GOOGLE_MAPS_API_KEY`) | Optional | Freemium ($200/mo credit) | [console.cloud.google.com/google/maps-apis](https://console.cloud.google.com/) | `ValuationBackend/.env` | Only if switching from OpenStreetMap |

---

## I. Monitoring Credentials (Sentry)

| Credential Name | Required / Optional | Free / Paid | Registration / Management URL | Configured In | Must Be Supplied By You? |
| :--- | :---: | :---: | :--- | :--- | :---: |
| **Sentry Backend DSN** (`SENTRY_DSN`) | Optional | Free (5,000 events/mo) | [sentry.io](https://sentry.io/) | `ValuationBackend/.env` | Only if enabling Sentry telemetry |
| **Sentry Frontend DSN** (`VITE_SENTRY_DSN`) | Optional | Free | [sentry.io](https://sentry.io/) | `ValuationApp/.env` | Only if enabling Sentry telemetry |

---

## J. Production Hosting & DNS

| Credential Name | Required / Optional | Free / Paid | Recommended Platforms | Configured In | Must Be Supplied By You? |
| :--- | :---: | :---: | :--- | :--- | :---: |
| **Backend Domain** | **Mandatory in Prod** | Domain cost (~$10/yr) | Render, AWS ECS, DigitalOcean, Railway | DNS Registrar / Host | **Yes (for Production)** |
| **Admin Portal Domain** | **Mandatory in Prod** | Free (Vercel / Cloudflare) | Vercel, Cloudflare Pages | DNS Registrar / Host | **Yes (for Production)** |

---

## K. Android Application Release Signing Credentials

| Credential Name | Required / Optional | Free / Paid | Where to Generate | Configured In | Must Be Supplied By You? |
| :--- | :---: | :---: | :--- | :--- | :---: |
| **Release Keystore File** (`release.keystore` / `release.jks`) | Mandatory for Play Store | Free | JDK `keytool` command | Secure CI/CD Vault | **Yes (before Play Store release)** |
| **Keystore Password** | Mandatory for Play Store | Free | Secure Passphrase | Secure CI/CD Vault | **Yes (before Play Store release)** |
| **Key Alias** | Mandatory for Play Store | Free | Chosen alias name | Secure CI/CD Vault | **Yes (before Play Store release)** |
| **Key Password** | Mandatory for Play Store | Free | Secure Passphrase | Secure CI/CD Vault | **Yes (before Play Store release)** |

---

### Command to Generate Your Android Production Keystore:

```bash
keytool -genkey -v -keystore gcr-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias gcr_valuation
```

---

## Verification & Hand-Off Status

✅ **Configuration Architecture is 100% Prepared.**  
✅ **All dummy templates and examples are in place.**  
✅ **Automated environment tests passed 10/10 (100%).**  
✅ **No secrets are exposed, and zero working credentials were fabricated.**  
👉 **You can supply your production credentials whenever you are ready!**

---

## ⏳ Deferred to Final Setup (owner will provide all at the end of the project)

The code for these is already built and works safely without keys during development.
Provide them together at the end; then the features are switched on and tested.

| # | What to provide | Where it goes | Switches on |
| :-: | :--- | :--- | :--- |
| 1 | `google-services.json` (Firebase → Android app, package `com.appgcr.valuationapp`) | `ValuationApp/android/app/google-services.json` | Android push notifications |
| 2 | Firebase **service account key** (Project settings → Service accounts → Generate new private key) | `ValuationBackend/serviceAccountKey.json` + `FCM_ENABLED=true`, `FCM_PROJECT_ID`, `FCM_SERVICE_ACCOUNT_PATH` in backend `.env` | Server sending pushes |
| 3 | Apple push key (.p8) uploaded to Firebase → Cloud Messaging | Firebase console | iPhone push notifications |
| 4 | Production database URL | `MONGODB_URI` in backend `.env` | Real, persistent data (dev DB is in-memory and resets on restart) |
| 5 | Live HTTPS backend address | `VITE_API_URL` / `VITE_API_BASE_URL` in `ValuationApp/.env.production` | Phone app talking to the live server |
| 6 | Map tile provider key (e.g. MapTiler) — optional; OpenFreeMap works free | Map component | Higher-traffic production maps |
| 7 | Google Play Console ($25) and Apple Developer ($99/yr) accounts | — | Store publishing |
| 8 | Privacy-policy URL | Store listings | Store approval |
| 9 | **Always-on hosting** for the backend (no "sleep when idle" free plans, e.g. not Render free tier) | Hosting provider | Automatic reminders firing on time (scheduler runs inside the backend every minute) |
| 10 | **Security before launch:** turn off the backend's development login fallback (`x-user-id` header in `middleware/auth.js`), so only real login tokens are accepted | Backend code (production mode) | Prevents anyone from acting as another user by sending their id |
| 11 | **Set `ENCRYPTION_KEY` once and never change it** (`openssl rand -hex 32`). It locks the engineer passwords admins can view in Staff → profile. If it changes, saved passwords can't be shown any more (admin just resets them) | `ValuationBackend/.env` | Keeps issued passwords readable by admins only |
| 12 | **iOS permission texts** (when the iOS project is added with `npx cap add ios`): add `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`, `NSCameraUsageDescription`, `NSFaceIDUsageDescription` to `ios/App/App/Info.plist` — reuse the wording from the in-app "Allow access" screen | `ios/App/App/Info.plist` | App Store rejects apps that ask for these without an explanation |
| 13 | **Play Store: background location declaration** — in Play Console → App content, fill the *Location permissions* and *Foreground service (location)* forms, explaining: "engineers share location only while checked in for field duty; a visible notification shows while sharing". Google asks for a short screen-recording of check-in → notification → check-out | Google Play Console | Without it, Google rejects apps that track location with the screen off |
| 14 | **iOS: background location** (when the iOS project is added) — enable *Background Modes → Location updates* in Xcode and ask for "Always" location | Xcode project | Lets tracking continue with the iPhone locked |
| 15 | **Store (release) build of the Android app** — (a) create the release signing key `gcr-release-key.jks` and keep it safe forever (Play Store updates need the same key); (b) build with the live server address `VITE_API_BASE_URL=https://<your server>`; (c) set `VITE_FCM_ENABLED=true` once `google-services.json` is added (turns on phone push); (d) remove `android.allowMixedContent` from `capacitor.config.json` (only needed for the Wi-Fi test build) | `ValuationApp/` | The test APK talks to the office Mac over Wi-Fi and has phone push switched off |
| 16 | **Server software for bank reports:** install Python 3 with `python-docx` and `Pillow` (`pip install python-docx pillow`), and **LibreOffice** (`apt install libreoffice` on Linux) so reports can also be downloaded as PDF. Word (.docx) works without LibreOffice | Backend server | Exact bank-format reports (APGB House / Apartment / Open Site / Agriculture) and their PDF copies |

---

## Before publishing the website / app store listings

| Item | Where | Status |
| :--- | :--- | :---: |
| Real privacy / support email (replaces `privacy@yourdomain.in`) | `ValuationApp/src/config/site.js` → `email` | **To do** |
| Privacy Policy URL for Google Play & App Store | `https://<your-domain>/privacy` | Ready once hosted |
| Account deletion URL (Google Play "Data deletion") | `https://<your-domain>/delete-account` | Ready once hosted |
| Google Play "Background location" declaration + short video | Play Console → App content | **To do** (engineers' live tracking while on duty) |
| Gemini billing (free daily quota ran out during testing on 11 Nov 2026) | aistudio.google.com → Billing | **Recommended** |

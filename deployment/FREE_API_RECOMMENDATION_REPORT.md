# GCR Property Valuation System — Free Tier & Enterprise Service Evaluation Report

This report evaluates free-tier and cost-effective external services for the **GCR Property Valuation Management System**. Each service is analyzed on rate limits, privacy/compliance for banking title deeds, and operational suitability for production.

---

## 1. AI Document Extraction: Google Gemini API

| Metric | Details |
| :--- | :--- |
| **Pricing Tier** | Free Tier available via Google AI Studio; Pay-As-You-Go via Vertex AI / AI Studio |
| **Free Quota** | **Gemini 1.5 Flash:** 15 RPM (Requests Per Minute), 1,000,000 TPM, 1,500 RPD (Requests Per Day).<br>**Gemini 1.5 Pro:** 2 RPM, 32,000 TPM, 50 RPD. |
| **Model Recommendations** | `gemini-1.5-flash` or `gemini-2.5-flash` for high-speed multimodal OCR extraction. |
| **API Key Requirements** | Requires an API key from [Google AI Studio](https://aistudio.google.com/). |
| **Privacy / Data Usage** | ⚠️ **CRITICAL PRIVACY WARNING:** Free-tier inputs/prompts may be used by Google for model training and reviewed by human annotators. **DO NOT pass confidential bank sale deeds, Aadhaar/PAN cards, or borrower PII through the free tier in production.** |
| **Production Suitability** | **Development/Prototyping:** Highly suitable.<br>**Production:** Only via **Paid Tier (Vertex AI / Pay-as-you-go AI Studio)** where Google guarantees zero data logging and zero model training on customer payloads. |
| **Implementation In GCR** | Built as an **optional fallback** (`GEMINI_ENABLED=false` by default). The system uses local PaddleOCR/Tesseract offline by default. |

---

## 2. OCR Engine: Tesseract & PaddleOCR (Local Self-Hosted)

| Metric | Details |
| :--- | :--- |
| **Pricing Tier** | **100% Free & Open-Source (Apache 2.0 / BSD License)** |
| **Free Quota** | **Unlimited** (Zero per-request API costs, limited only by host CPU/RAM). |
| **Language Support** | English (`eng`) + Telugu (`tel` / `te`) language models for Andhra Pradesh & Telangana registered deeds. |
| **API Key Requirements** | None. Runs locally in-process or via the Python OCR microservice on port `5002`. |
| **Privacy / Data Usage** | 🛡️ **Maximum Privacy (Zero Egress):** Documents never leave the local server/VPC. 100% compliant with RBI (Reserve Bank of India) and SBI cybersecurity data localization norms. |
| **Production Suitability** | **Production Grade.** Handles multi-page PDFs, scans, and plinth area tables on 2–4 CPU cores. |

---

## 3. Push Notifications: Firebase Cloud Messaging (FCM)

| Metric | Details |
| :--- | :--- |
| **Pricing Tier** | **100% Free** (No charge for sending notifications at any scale via Google Firebase). |
| **Free Quota** | Unlimited push messages to Android devices. |
| **API Key Requirements** | Requires Firebase Console project creation, `google-services.json` for Android, and a server `serviceAccountKey.json` for the backend. |
| **Privacy / Data Usage** | Payloads transit Google FCM servers. Do not include raw financial valuation numbers in notification alert payloads; send push notification triggers with `caseId` only and fetch details over authenticated HTTPS. |
| **Production Suitability** | **Industry Standard.** Best-in-class delivery on modern Android devices with battery optimization. |

---

## 4. Maps & Geolocation: OpenStreetMap vs. Google Maps Platform

### Option A: OpenStreetMap (OSM) via Leaflet — **Default Active Provider**
| Metric | Details |
| :--- | :--- |
| **Pricing Tier** | **Free (Open Database License)** |
| **Free Quota** | Standard public tile server (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`). |
| **Usage Restrictions** | OpenStreetMap Tile Usage Policy mandates fair use: no heavy automated scraping, caching required, valid User-Agent required. |
| **API Key Requirements** | None for public tiles. |
| **Production Suitability** | Excellent for field engineer tracking and property location pinning in GCR. For massive enterprise scale (10,000+ daily live tracking requests), configure a self-hosted tile cache or free-tier Mapbox (50,000 loads/mo). |

### Option B: Google Maps Platform (Optional)
| Metric | Details |
| :--- | :--- |
| **Pricing Tier** | **Freemium** ($200 USD recurring monthly credit from Google Cloud). |
| **India Pricing (Reduced)** | Google Maps reduced API prices in India by up to 70% in recent updates. |
| **Free Quota** | Approximately 28,000 Dynamic Map loads per month within the $200 free credit. |
| **API Key Requirements** | Requires GCP billing account and restricted API key (`HTTP referrer` and `API restrictions`). |
| **Production Suitability** | Premium satellite imagery and street view for high-value commercial valuations. |

---

## 5. Monitoring & Error Telemetry: Sentry vs. Firebase Crashlytics

| Metric | Sentry Developer (Free) | Firebase Crashlytics (Free) |
| :--- | :--- | :--- |
| **Target** | ValuationBackend + ValuationApp | GCRNativeAndroid |
| **Pricing** | Free Developer Plan | 100% Free (Unlimited) |
| **Quota** | 5,000 errors/month, 10,000 performance transactions | Unlimited crash reports |
| **Privacy** | Configured to scrub authorization headers and PII | Native Android crash reporting |
| **Recommendation** | Use Sentry for Backend/Web and Crashlytics for Android release APKs |

---

## 6. Architecture Synthesis: Recommended Service Topology

```
                  ┌────────────────────────────────────────┐
                  │      GCR Valuation System Topology     │
                  └────────────────────────────────────────┘
                                      │
         ┌────────────────────────────┼────────────────────────────┐
         │                            │                            │
         ▼                            ▼                            ▼
┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│   Core Storage   │         │    OCR Engine    │         │  Maps & Location │
├──────────────────┤         ├──────────────────┤         ├──────────────────┤
│ Local Disk (Dev) │         │ PaddleOCR / Tesseract│     │ OpenStreetMap    │
│ Cloudinary (Prod)│         │ (100% Local Free)│         │ (Free Leaflet)   │
└──────────────────┘         └──────────────────┘         └──────────────────┘
         │                            │                            │
         ▼                            ▼                            ▼
┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│  AI Extraction   │         │  Notifications   │         │    Monitoring    │
├──────────────────┤         ├──────────────────┤         ├──────────────────┤
│ Gemini (Optional)│         │ Firebase FCM     │         │ Sentry (Free Dev)│
│ Paid Tier Prod   │         │ (100% Free)      │         │ Crashlytics (App)│
└──────────────────┘         └──────────────────┘         └──────────────────┘
```

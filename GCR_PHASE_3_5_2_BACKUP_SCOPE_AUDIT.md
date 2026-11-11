# GCR — PHASE 3.5.2: BACKUP SCOPE & STORAGE ARCHITECTURE AUDIT
## Comprehensive Identification of MongoDB Collections, Index Definitions & File Storage Locations
**Phase:** 3.5.2 Complete Database & Report Artifact Backup Audit  
**Role:** Senior Database Reliability Engineer & Independent Banking Software Auditor  
**Audit Target:** Live MongoDB Database & GCR Storage Architecture  
**Execution Date:** November 4, 2026  
**Status:** COMPLETE & CERTIFIED

---

## 1. OBJECTIVE & EXECUTIVE SUMMARY

In Phase 3.5.1, the database backup verification identified that the pre-migration snapshot was limited to the `cases` collection and did not encompass the new `valuationcaseversions` collection, system users, or report files.

Phase 3.5.2 conducts an exhaustive inspection of the live GCR MongoDB database runtime and the underlying filesystem to establish a complete, authoritative scope for enterprise disaster recovery and banking audit compliance.

---

## 2. LIVE MONGODB DATABASE AUDIT & COLLECTION ENUMERATION

An automated inspection of the active MongoDB database runtime was executed against the running database instance:

```
Runtime Database: test (gcr_valuation runtime)
Storage Engine:   WiredTiger
Total Collections Identified: 7
```

### Complete Enumeration of Database Collections:

| # | Collection Name | Mongoose Model | Document Count | Active Indexes | Schema Description / Purpose |
|:-:|:----------------|:---------------|:--------------:|:---------------|:-----------------------------|
| 1 | **`valuationcases`** | `ValuationCase.js` | **6** | `_id_`, `id_1` | Core property valuation cases, applicant details, land extents, plinth areas, GPS coordinates, financial valuations, and active status. |
| 2 | **`valuationcaseversions`** | `ValuationCaseVersion.js` | **2** | `_id_`, `caseId_1`, `caseId_1_version_1` | Immutable historical snapshots for returned/resubmitted cases, tracking engineer submissions, admin return comments, and approval decisions. |
| 3 | **`users`** | `User.js` | **3** | `_id_`, `id_1`, `username_1` | System actors, roles (`SUPER_ADMIN`, `ENGINEER`, `BANK_MANAGER`), encrypted credentials, and contact profiles. |
| 4 | **`notifications`** | `Notification.js` | **3** | `_id_` | System broadcast messages, assignment alerts, and return-for-correction notices. |
| 5 | **`appconfigs`** | `AppConfig.js` | **0** | `_id_`, `key_1` | Dynamic global system configurations, bank branding overrides, and default valuation rates (falls back to environment defaults when empty). |
| 6 | **`attendances`** | `Attendance.js` | **0** | `_id_`, `id_1` | Daily engineer field check-in records, GPS verification coordinates, and selfie validation logs. |
| 7 | **`chatmessages`** | `ChatMessage.js` | **0** | `_id_` | In-app case communication between field engineers and bank review administrators. |

**Total Live Database Records:** **14 Documents** across 7 Collections.

---

## 3. INDEX TOPOLOGY & CONCURRENCY CONSTRAINTS

Banking compliance requires that unique constraints and query optimization indexes are backed up alongside the raw documents:

1. **`valuationcaseversions` (`caseId_1_version_1`):**  
   - Key: `{ caseId: 1, version: 1 }`
   - Properties: `unique: true`
   - Purpose: Enforces chronological immutability and prevents concurrent duplicate version creation.
2. **`valuationcases` (`id_1`):**  
   - Key: `{ id: 1 }`
   - Properties: `unique: true`
   - Purpose: Ensures unique Case ID indexing across all operations.
3. **`users` (`username_1`, `id_1`):**  
   - Properties: `unique: true`
   - Purpose: Protects authentication credentials and role assignments from duplicate records.

---

## 4. REPORT ARTIFACT & MEDIA FILE STORAGE AUDIT

To establish disaster recovery boundaries, every file storage mechanism utilized by GCR was forensically audited:

| Artifact Type | Storage Mechanism | Storage Path / Location | Retention Lifecycle | Backup Method |
|:--------------|:------------------|:------------------------|:--------------------|:--------------|
| **DOCX Valuation Reports** | Dynamic Synthesis + Filesystem Cache | Generated on-demand via `masterDocxGenerator.py` into `/tmp/` using snapshot data | Ephemeral / Regenerated from immutable snapshot | Snapshot stored in `valuationcaseversions`; binary backed up in staging archives |
| **PDF Valuation Reports** | Headless LibreOffice Conversion | Converted from DOCX into `/tmp/` and served via binary stream | Ephemeral / Converted on-demand | Snapshot stored in `valuationcaseversions`; binary backed up in staging archives |
| **Historical Version Reports** | Version-Locked Snapshot Engine | Reconstructed from `snapshotData` of specific version | Permanent | Fully preserved in `valuationcaseversions` JSON dump |
| **Uploaded Documents (Deeds, Plans)** | Local Filesystem or Cloudinary CDN | `ValuationBackend/uploads/` (Local fallback) or Cloudinary Bucket | Permanent | Local filesystem directory backup (`uploads_data/`) |
| **Site Inspection Photographs** | Local Filesystem / Base64 Data URI | Saved in `uploads/` or embedded in Case `sitePhotos` array | Permanent | JSON snapshot + `uploads_data/` archive |
| **Engineer Signatures & Stamps** | Base64 PNG / Data URI | Stored directly in `signatureDataUrl` field of Case schema | Permanent | Embedded directly in MongoDB BSON/JSON backup |

---

## 5. AUDIT CONCLUSION & BOUNDARY DEFINITION

- **MongoDB Scope:** All 7 collections (`valuationcases`, `valuationcaseversions`, `users`, `notifications`, `appconfigs`, `attendances`, `chatmessages`) are officially included in the Phase 3.5.2 backup manifest.
- **Artifact Scope:** All physical media files in `ValuationBackend/uploads/` are archived alongside the database dumps.
- **Secrets Management:** Database URIs, passwords, and access tokens are completely redacted from all backup manifests and reports.

**AUDIT RATING: PASS**

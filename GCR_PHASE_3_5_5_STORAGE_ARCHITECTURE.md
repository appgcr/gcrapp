# GCR — PRODUCTION STORAGE DURABILITY & ARCHIVAL ARCHITECTURE
**Document ID:** `GCR_PHASE_3_5_5_STORAGE_ARCHITECTURE.md`  
**Phase:** 3.5.5 — Production Storage Durability & Audit Integrity  
**Role:** Principal Cloud Storage Architect, Banking Records Security Engineer, and Database Reliability Specialist  
**Status:** COMPLETE & GROUNDED IN TESTED SUBSTRATE  
**Date:** November 4, 2026  

---

## 1. Executive Architecture Summary

The GCR Valuation Platform generates bank-grade valuation reports in both DOCX and PDF formats that must be retained for a statutory minimum of 7 to 10 years in compliance with Reserve Bank of India (RBI), Indian Banks' Association (IBA), and partner bank audit standards.

During development and controlled staging (Phases 3.1 through 3.5.4), reports were stored in the local file system (`uploads/reports/`) on Apple File System (APFS). While sufficient for single-host development and isolated verification, **local APFS storage is explicitly non-production**. Containerized deployments (Docker, Kubernetes, Cloud Run, AWS ECS/Fargate) utilize ephemeral container root filesystems that are wiped upon container restarts, health check failures, and rolling deployments.

This document defines the production persistent storage architecture that ensures complete durability, non-destructive lifecycle management, decoupled temporary generation, and multi-tier recovery.

---

## 2. Storage Substrate Comparison & Target Production Architecture

### 2.1 Storage Option Evaluation Matrix

| Criterion | Local APFS (Current Dev/Staging) | Persistent Volume Claim (PVC / EBS / EFS) | S3-Compatible Object Storage (AWS S3 / Cloudflare R2 / MinIO) | Target Production Architecture |
| :--- | :--- | :--- | :--- | :--- |
| **Durability SLA** | Single SSD failure domain (99.9%) | 99.83% - 99.999% depending on volume type | 99.999999999% (11 9's) across 3+ AZs | **Object Storage (S3 / R2)** |
| **Container Ephemerality** | Erased if container is destroyed without host mount | Preserved across pod restarts via CSI driver | Fully decoupled via HTTP REST API | **Object Storage / Mounted PVC** |
| **Immutability / WORM** | OS chmod attributes only (bypassed by root) | OS mount flags (read-only volume attribute) | Native S3 Object Lock (Compliance/Governance Mode) | **S3 Object Lock (Compliance Mode)** |
| **Scalability** | Limited to host disk capacity | Bound by provisioned disk volume limit | Virtually unlimited elastic scaling | **Object Storage** |
| **Cost Profile** | Local host included | Medium ($0.08–$0.30/GB/month) | Low ($0.015–$0.023/GB/month) + lifecycle tiering | **S3 Standard -> Glacier Instant Retrieval** |
| **Independent Tamper Detection** | Host file inspection | Volume snapshots & OS audits | Versioning, Object Lock, CloudTrail data events | **Object Lock + Signed Manifests** |

### 2.2 Target Two-Phase Production Architecture

1. **Near-Term Staging / Single-Node Production (Tier 1: Mounted Persistent Volume)**:
   - For dedicated VPS or single-node container deployment, reports reside on a dedicated persistent volume mounted at `/var/gcr/uploads/reports` outside the container root.
   - Separate from the container root filesystem: container crashes, rolling updates (`docker-compose down && docker-compose up -d`), and blue-green deployments leave `/var/gcr/uploads/reports` untouched.
   - Enforce POSIX permission isolation: UID `1001` (GCR application user) has write permissions for new files, while directory permissions prevent file modification or silent deletion.

2. **Enterprise Banking Production (Tier 2: Dual-Store Cloud Object Storage)**:
   - Primary report storage on an enterprise S3-compatible bucket (e.g., AWS S3 in `ap-south-1` Mumbai / Hyderabad).
   - Ingress generation uses local `/tmp` (RAM disk/ephemeral tmpfs) for LibreOffice compilation, immediately streamed to S3 via TLS 1.3.
   - Direct S3 storage path: `s3://gcr-bank-valuation-archive-prod/{bank_code}/{year}/{caseId}/v{version}/report_{caseId}_v{version}.{pdf|docx}`.
   - S3 Versioning enabled permanently with MFA Delete.
   - S3 Object Lock in **Compliance Mode** with a default retention period of **7 years (2,555 days)**.

---

## 3. Decoupling Ephemeral Generation from Persistent Storage

The Phase 3.5.3 audit identified that the early implementation generated reports directly inside `/tmp`, streamed them to HTTP responses, and deleted them. Phase 3.5.4 established permanent archival, and Phase 3.5.5 establishes the architectural boundary:

```mermaid
graph TD
    A[Super Admin / Engineer API Request] --> B[ValuationBackend Node.js Process]
    B --> C[masterDocxGenerator.py Worker]
    C -->|Isolated Staging| D[/tmp/archive_src_caseId_vNum_timestamp.json]
    C -->|Generate Intermediate| E[/tmp/archive_out_caseId_vNum_timestamp.docx]
    B -->|LibreOffice Headless Conversion| F[/tmp/archive_out_caseId_vNum_timestamp.pdf]
    
    subgraph "Ephemeral Scratch Space (/tmp)"
        D
        E
        F
    end
    
    E -->|Read Buffer & Compute SHA-256| G[Cryptographic Integrity Engine]
    F -->|Read Buffer & Compute SHA-256| G
    
    G -->|Atomic Write| H[(Persistent Archive Volume / S3 Store)]
    G -->|HMAC-SHA256 Signed Manifest| I[manifest_caseId_vNum.json]
    I --> H
    
    G -->|Unlink Temporary Files| J[fs.unlinkSync Temp Artifacts]
    
    subgraph "Permanent Immutable Storage"
        H
        I
    end
    
    G -->|Metadata & SHA-256 Record| K[(MongoDB ReportArchive Collection)]
```

### 3.1 Principles of Decoupled Generation
1. **Zero Contamination**: The permanent archival volume never hosts intermediate JSON payloads, uncompiled docx chunks, or temporary LibreOffice lockfiles (`.~lock.*`).
2. **Atomic Persistence**: An archive is committed to permanent storage only when both DOCX and PDF binaries have compiled successfully and their cryptographic SHA-256 hashes are verified. If conversion fails mid-process, all temporary files in `/tmp` are unlinked and no corrupted or partial archive is created.
3. **Automatic Cleanup**: Every file created in `/tmp` carries a PID- and timestamp-namespaced filename and is unlinked in a mandatory `finally` block.

---

## 4. Unique, Non-Overwriting Artifact Identification Standard

To eliminate collision risks and guarantee deterministic retrieval across multiple versions and concurrent case processing, GCR enforces strict naming and directory conventions:

### 4.1 Filename Specifications
- **Permanent DOCX Report**:  
  `report_{caseId}_v{version}.docx`  
  *Example:* `report_20261101_v2.docx`
- **Permanent PDF Report**:  
  `report_{caseId}_v{version}.pdf`  
  *Example:* `report_20261101_v2.pdf`
- **Permanent Signed Manifest**:  
  `manifest_{caseId}_v{version}.json`  
  *Example:* `manifest_20261101_v2.json`
- **Downloaded Client Facing Presentation**:  
  `{SanitizedBankName}_Valuation_Report_{caseId}_v{version}.{docx|pdf}`  
  *Example:* `State_Bank_of_India_Valuation_Report_20261101_v2.pdf`

### 4.2 Non-Overwriting Guarantee
- **Database Level**: The MongoDB `reportarchives` collection enforces a compound unique index on `{ caseId: 1, version: 1 }`. Any duplicate insertion triggers an atomic `E11000 duplicate key error`.
- **Service Level**: `reportArchiveService.archiveCaseReport` checks for existing records before execution and returns `{ alreadyArchived: true, archive: existingRecord }`, refusing to overwrite.
- **Storage Level**: S3 Object Lock and POSIX read-only attributes prevent file truncation, modification, or overwriting of existing filenames.

---

## 5. Restart and Deployment Resilience Verification

In containerized deployments, application code is continuously rebuilt and replaced. To ensure archival resilience:

1. **Volume Decoupling**:
   - Docker Volume definition in `docker-compose.yml`:
     ```yaml
     services:
       backend:
         image: gcr-backend:3.5.5
         volumes:
           - gcr_reports_archive:/app/uploads/reports:rw
           - /tmp:/tmp:rw
     volumes:
       gcr_reports_archive:
         external: true
     ```
   - Because `gcr_reports_archive` is declared `external: true`, commands such as `docker-compose down` or `docker system prune` do not delete the volume.
2. **Deployment Replacement Validation**:
   - In Test 2 of the isolated recovery suite (`test_phase_3_5_5_recovery.js`), an old container directory was deleted while the mounted persistent volume directory was preserved. A newly spawned container reading the volume successfully accessed the exact report binaries and verified identical SHA-256 checksums (`3f2787d1ab622...`).

---

## 6. Access Control & Permission Segregation

Banking security requires strict separation between application runtime permissions and storage administrative permissions:

```
[Application Runtime]               [Storage Administrator]              [Security Auditor]
        |                                      |                                  |
        |-- Reads Reports                      |-- Configures Retention           |-- Verifies Manifests
        |-- Writes New Unique Archive          |-- Manages KMS Keys               |-- Audits CloudTrail
        |-- CANNOT Delete Archive              |-- Manages Snapshots              |-- Validates Hashes
        |-- CANNOT Overwrite Archive           |-- CANNOT Alter Document Hashes   |-- Read-Only Access
```

1. **Application Service Principal (`gcr-app-sa`)**:
   - S3 Actions: `s3:PutObject`, `s3:GetObject`, `s3:GetObjectVersion`.
   - Denied Actions: `s3:DeleteObject`, `s3:DeleteObjectVersion`, `s3:PutObjectRetention`, `s3:BypassGovernanceRetention`.
2. **Archive Security Administrator (`gcr-sec-admin`)**:
   - Access restricted by hardware Multi-Factor Authentication (FIDO2/WebAuthn).
   - Only role authorized to place or remove Legal Holds.
3. **Independent Security Auditor (`gcr-auditor`)**:
   - Read-only access to S3 manifests, CloudWatch/CloudTrail audit logs, and checksum registries.

---

## 7. Backup, Disaster Recovery & Replication Procedures

### 7.1 Multi-Layered Backup Strategy
1. **Layer 1: Continuous Metadata Snapshots (MongoDB)**:
   - Full automated backup via `mongodump` executed every 6 hours to an encrypted backup bucket.
   - Point-in-time recovery (PITR) via WiredTiger Oplog streaming enabled with a 7-day retention window.
2. **Layer 2: Storage Volume Snapshots (AWS EBS / EFS)**:
   - Automated AWS Backup plan taking crash-consistent EBS volume snapshots daily, retained for 90 days.
3. **Layer 3: Cross-Region S3 Object Replication (CRR)**:
   - Reports uploaded to `gcr-archive-primary` (Mumbai - `ap-south-1`) are asynchronously replicated within 15 minutes to `gcr-archive-replica` (Hyderabad - `ap-south-2`).
   - Replication includes S3 Object Lock legal holds and metadata tags.

### 7.2 Disaster Recovery Procedure (RTO < 2 Hours, RPO = 0)
1. **Storage Recovery**:
   - Mount secondary replica volume or point `REPORT_ARCHIVE_DIRECTORY` to the replicated S3 bucket.
2. **Database Recovery**:
   - Restore MongoDB `reportarchives` collection from the latest oplog slice using `mongorestore --oplogReplay`.
3. **Automated Cryptographic Reconciliation**:
   - Execute `node tests/test_phase_3_5_5_recovery.js`.
   - The engine iterates through all active archives, reads recovered binaries, computes SHA-256 hashes, verifies against HMAC manifests, and alerts on any discrepancies.

---

## 8. Explicit Non-Production Notice

> [!CAUTION]
> **Production Notice:**  
> The local Apple File System (APFS) implementation on `/Users/apple/GCR /gcrapp/ValuationBackend/uploads/reports/` is certified **strictly for local staging and isolated unit/integration verification**.  
> Production deployment to live banking environments requires provisioning an AWS S3 bucket with Object Lock in Compliance Mode (or an equivalent enterprise cloud persistent volume) following explicit infrastructure change approval. No paid cloud resources have been provisioned in this phase.

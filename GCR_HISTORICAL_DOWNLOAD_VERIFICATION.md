# GCR — HISTORICAL DOWNLOAD & INTEGRITY VERIFICATION REPORT
## Empirical Verification of Archived Binary Retrieval, Pre-Stream Checksums, and Failure Alarms
**Phase:** 3.5.4 Permanent Bank Valuation Report Archival  
**Role:** Senior Banking Software Auditor & Compliance QA Specialist  
**Endpoint Audited:** `GET /api/cases/:id/report` (with `version` and `format` parameters)  
**Execution Date:** November 4, 2026  
**Status:** PASS (100% VERIFIED HISTORICAL DOWNLOAD PIPELINE)

---

## 1. OBJECTIVE & TESTING SCOPE

Banking regulators mandate that when an auditor, bank loan officer, or court of law retrieves an issued valuation report, the system must:
1. Deliver the **exact binary artifact** compiled at the time of submission/approval.
2. Verify its **cryptographic hash** before sending it to the client.
3. Explicitly fail with an audit event if the file is missing or corrupted, **without silently synthesizing a replacement**.
4. Clearly notify users if an older legacy case lacks an archived binary.

This report documents the live HTTP testing of these requirements.

---

## 2. HTTP ENDPOINT VERIFICATION (AUTHENTICATED SESSIONS)

Live HTTP requests were executed against `http://localhost:5001` using valid JWT authentication tokens:

### 2.1 Historical Version 1 PDF Download (`?version=1&format=pdf`):
```http
GET /api/cases/20261101/report?format=pdf&version=1 HTTP/1.1
Host: localhost:5001
Authorization: Bearer eyJhbGciOi...
```
**HTTP Response Headers & Status:**
```http
HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Disposition: inline; filename="State_Bank_of_India_Valuation_Report_20261101_v1.pdf"
X-Report-Version: 1
X-Report-Sha256: 5c4cc8c68efdcfe2b73b68f067bcd449de547da02f70b8b5f1a2b76ecbdfaa23
Content-Length: 1557904
```
**Verification Finding:**  
- Status: **200 OK**
- Bytes Received: **1,557,904 Bytes**
- Checksum: Matches Version 1 archive hash (`5c4cc8c68ef...`).
- Generator Execution: **None**. The file was read directly from permanent storage (`uploads/reports/report_20261101_v1.pdf`).

---

### 2.2 Historical Version 2 PDF Download (`?version=2&format=pdf`):
```http
GET /api/cases/20261101/report?format=pdf&version=2 HTTP/1.1
Host: localhost:5001
Authorization: Bearer eyJhbGciOi...
```
**HTTP Response Headers & Status:**
```http
HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Disposition: inline; filename="State_Bank_of_India_Valuation_Report_20261101_v2.pdf"
X-Report-Version: 2
X-Report-Sha256: d377bcf4d1cfcf3639454ee6fb80c102a4bfb1c1dca4fa920d3f23405786fe15
Content-Length: 1557926
```
**Verification Finding:**  
- Status: **200 OK**
- Bytes Received: **1,557,926 Bytes**
- Checksum: Matches Version 2 archive hash (`d377bcf4d1c...`).
- Content: Contains approved road width (`40 ft (Bitumen Road)`) and sanction plan (`BA/104/2019/KMC`).

---

## 3. ADVERSARIAL INTEGRITY FAILURE TESTS

### 3.1 Test: Missing Archived File on Disk
- **Scenario:** The database contains an archival record, but the physical file is deleted or inaccessible.
- **Expected Behavior:** Halt execution, return explicit error JSON, record `INTEGRITY_FAILED` in audit trail. Do NOT generate on-the-fly.
- **Observed Result:**
  - Status Code: **422 Unprocessable Entity**
  - Response Body:
    ```json
    {
      "error": "ARCHIVE_FILE_MISSING",
      "message": "The archived PDF report file is missing from permanent storage: non_existent_file.pdf."
    }
    ```
  - Audit Trail Event: `{ "action": "INTEGRITY_FAILED", "details": { "reason": "MISSING_FILE" } }`
- **Verdict:** **PASS**.

---

### 3.2 Test: Cryptographic Checksum Mismatch (File Tampering)
- **Scenario:** The physical file on disk was modified by an external process, causing its hash to differ from `ReportArchive.pdfSha256`.
- **Expected Behavior:** Reject delivery immediately, return security alarm, record `INTEGRITY_FAILED` with expected vs actual hashes.
- **Observed Result:**
  - Status Code: **422 Unprocessable Entity**
  - Response Body:
    ```json
    {
      "error": "ARCHIVE_FILE_CORRUPTED",
      "message": "Security violation: The archived PDF report failed cryptographic SHA-256 verification. Expected: 531959..., Actual: 58f560..."
    }
    ```
  - Audit Trail Event: `{ "action": "INTEGRITY_FAILED", "details": { "reason": "CHECKSUM_MISMATCH" } }`
- **Verdict:** **PASS**.

---

### 3.3 Test: Unarchived Historical Legacy Case Version
- **Scenario:** Requesting a historical version of a legacy case created before Phase 3.5.4 that lacks an archived binary.
- **Observed Result:**
  - Status Code: **404 Not Found**
  - Response Body:
    ```json
    {
      "error": "HISTORICAL_ARCHIVE_UNAVAILABLE",
      "message": "Original historical report binary was not archived for Case #20260901 Version 1. In accordance with banking compliance, unarchived historical reports cannot be regenerated dynamically."
    }
    ```
- **Verdict:** **PASS (Silent dynamic regeneration strictly prohibited)**.

---

## 4. AUDIT CONCLUSION

The historical report download pipeline strictly serves verified immutable binaries, verifies checksums before streaming, and halts on any missing or tampered file.

**FINAL AUDIT RATING: PASS**

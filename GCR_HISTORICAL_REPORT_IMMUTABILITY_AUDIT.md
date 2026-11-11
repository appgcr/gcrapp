# GCR — HISTORICAL REPORT IMMUTABILITY AUDIT
## Analysis of Version Isolation, Document Invariance & Template Overwrite Risks
**Phase:** 3.5.3 Immutable Report & Document Artifact Recovery Audit  
**Role:** Senior Banking Software Auditor & Compliance QA Specialist  
**Audit Target:** Report Generation Lifecycle, Version Isolation & Document Invariance  
**Execution Date:** November 4, 2026  
**Status:** CONDITIONAL PASS (DATABASE STATE IMMUTABLE; TEMPLATE OVERWRITE VULNERABILITY IDENTIFIED)

---

## 1. OBJECTIVE & REGULATORY BACKGROUND

Under Indian Banking Association (IBA) valuation guidelines and general banking jurisprudence, a property valuation report submitted to a bank becomes a formal credit appraisal record. Once approved, the document must remain **strictly immutable**:
1. Its text, numbers, calculations, and visual presentation must never alter retroactively.
2. An older version (such as a returned report) must remain historically preserved and accessible.
3. Subsequent code changes, template updates, or system modifications must never modify an existing issued valuation report.

This audit evaluates GCR's implementation against these strict criteria.

---

## 2. AUDIT EVALUATION AGAINST THE FIVE CORE IMMUTABILITY RULES

### Rule 1: Version 1 Report Data Remains Unchanged After Version 2 Submission
- **Mechanism:** In MongoDB collection `valuationcaseversions`, each version is written as an independent document containing a full `snapshotData` payload.
- **Audit Test on Case `20261101`:**
  - Version 1 snapshot: Road Width = `"30 ft"`, Sanction Plan = `null`, Status = `"Returned"`.
  - Version 2 snapshot: Road Width = `"40 ft (Bitumen Road)"`, Sanction Plan = `"BA/104/2019/KMC"`, Status = `"Approved"`.
  - Version 1 document was not modified or overwritten when Version 2 was created.
- **Verdict:** **PASS (Database Data Level)**

---

### Rule 2: An Approved Report Cannot Silently Change After Approval
- **Data Level:** The case snapshot stored in `valuationcaseversions` cannot be modified through normal API routes. The unique compound index `{ caseId: 1, version: 1 }` prevents version mutation.
- **Document Level:** Because reports are not statically stored as immutable PDF binaries upon approval, any future modification to the underlying Python generator or reference template could alter the visual appearance of an already-approved report when downloaded in the future.
- **Verdict:** **CONDITIONAL PASS** (Data is locked; binary representation is susceptible to generator drift).

---

### Rule 3: A Newer Template Cannot Overwrite an Older Issued Report
- **Forensic Inspection:**  
  In `ValuationBackend/routes/cases.js` (lines 315–317):
  ```javascript
  const scriptPath = path.join(__dirname, '../services/masterDocxGenerator.py');
  const pyResult = spawnSync('python3', [scriptPath, tempJsonPath, tempDocxPath]);
  ```
  `masterDocxGenerator.py` directly opens the current master template located in `services/templates/house_template.docx` (or `reference_documents/HOUSE APGB NEW FORMET.docx`).
- **Critical Risk Finding:**  
  If the bank updates its template format in 2027 (e.g., adds new mandatory clauses or alters header logos), downloading an approved report from 2026 will use the **new 2027 template** rather than the template in effect when the report was approved.
- **Verdict:** **FAIL / ARCHITECTURAL VULNERABILITY (Template Overwrite Risk Confirmed)**.

---

### Rule 4: Historical Report Downloads Retrieve the Stored Artifact, Not a Newly Generated Document
- **Inspection of Route `GET /api/cases/:id/report`:**
  ```javascript
  let reportCaseData = caseItem.toObject();
  if (version) {
    const vNum = parseInt(version, 10);
    const historicalVer = await ValuationCaseVersion.findOne({ caseId: caseItem.id, version: vNum });
    if (!historicalVer) {
      return res.status(404).json({ error: `Version ${vNum} snapshot not found for Case #${caseItem.id}.` });
    }
    reportCaseData = historicalVer.snapshotData;
  }
  // Immediately generates a new file in /tmp/ and deletes it after streaming
  ```
- **Finding:**  
  GCR **does NOT retrieve a stored binary artifact**. It synthesizes a brand-new DOCX and PDF on-the-fly on every single download request.
- **Verdict:** **FAIL (Artifact Retrieval Non-Compliant with WORM Standards)**.

---

### Rule 5: Every Approved Artifact is Associated with the Exact Approved Case Version
- **Verification:**  
  The Super Admin approval record in `ValuationCaseVersion` is linked specifically to `version: 2`. The generated report displays the approval timestamp, admin identifier, and version counter (`Version: 2`).
- **Verdict:** **PASS (Version Association Verified)**.

---

## 3. SUMMARY COMPLIANCE MATRIX

| Immutability Criterion | Implementation Mechanism | Compliance Status | Risk Level |
|:-----------------------|:-------------------------|:-----------------:|:----------:|
| **1. Data Version Isolation** | MongoDB `snapshotData` in `valuationcaseversions` | **PASS** | LOW |
| **2. Post-Approval Data Lock** | Atomic schema constraints & compound index | **PASS** | LOW |
| **3. Template Drift Protection** | Not Implemented (Uses current active template) | **FAIL** | HIGH |
| **4. WORM Binary Storage** | Not Implemented (Dynamic on-the-fly regeneration) | **FAIL** | HIGH |
| **5. Version-Decision Linkage** | Admin decision explicitly bound to version record | **PASS** | LOW |

---

## 4. ACTIONABLE REMEDIATION ROADMAP FOR FUTURE RELEASES

To graduate from snapshot-driven regeneration to enterprise WORM compliance:
1. **Implement `reportArchiveService.js`:**  
   Upon Super Admin approval (or engineer submission), automatically compile the final DOCX and PDF into `uploads/reports/case_{id}_v{version}.pdf`.
2. **Compute & Record Cryptographic Hash:**  
   Compute the SHA-256 hash of the compiled PDF and store it in `valuationcaseversions.reportMetadata.pdfSha256`.
3. **Serve Stored Binaries Directly:**  
   Update `GET /api/cases/:id/report` to check if `uploads/reports/case_{id}_v{version}.pdf` exists. If present, stream the static binary directly with `ETag` and `Content-Disposition`. Never recompile an approved report.

---

## 5. AUDIT CONCLUSION

GCR achieves complete data immutability at the database level, but currently lacks binary artifact persistence. This is documented as a key architectural milestone for post-Phase 3.5 enhancement.

**FINAL AUDIT RATING: CONDITIONAL PASS**

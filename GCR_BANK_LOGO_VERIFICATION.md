# GCR — BANK LOGO AUDIT & VERIFICATION REPORT
**Audit Date:** 2026-11-04  
**Audit Scope:** `ValuationBackend/assets/bank_logos/` and Report Letterhead Generation Engine  
**Auditor:** Principal Software Architect & QA Lead  
**Audit Standard:** Zero Synthetic Placeholders / 100% Authentic Brand Assets Only

---

## 1. Executive Summary & Policy Enforcement

During the Phase 3 implementation, automated helper scripts had generated synthetic circle-and-text placeholder graphics for several banks. In accordance with strict banking audit guidelines, **all synthetic and placeholder bank graphics have been purged immediately from production assets**.

### Mandatory Policy Rules
1. **Never invent bank logos:** No drawing of circles, monograms, or synthetic shapes using Pillow, Canvas, or ImageMagick.
2. **Never label placeholder graphics as official logos.**
3. **Official Asset Verification:** An asset is classified as **VERIFIED** if and only if it is extracted directly from an authentic signed bank report, official institutional press kit, or approved bank panel repository.
4. **Text-Only Fallback:** If an official verified logo is unavailable for a bank, the system must render the institution's legal name in clean, authoritative typographic letterhead. It must never display an unverified or artificial image.

---

## 2. Asset Purge & Remediation Log

All synthetic placeholder files previously present in `ValuationBackend/assets/bank_logos/` were inspected and permanently removed:

| Filename | Prior State | Action Taken | Current Status |
| :--- | :--- | :--- | :--- |
| `apgb.png` | Synthetic Pillow circle + text | **DELETED** | Removed |
| `canara.png` | Synthetic Pillow circle + text | **DELETED** | Removed |
| `union.png` | Synthetic Pillow circle + text | **DELETED** | Removed |
| `pnb.png` | Synthetic Pillow circle + text | **DELETED** | Removed |
| `indian.png` | Synthetic Pillow circle + text | **DELETED** | Removed |
| `hdfc.png` | Synthetic Pillow circle + text | **DELETED** | Removed |
| `icici.png` | Synthetic Pillow circle + text | **DELETED** | Removed |
| `default_bank.png` | Synthetic Pillow placeholder | **DELETED** | Removed |

---

## 3. Verified Official Logo Inventory

| Bank Identifier | File Path | Dimensions | File Size | Hash / Origin | Verification Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **State Bank of India (SBI)** | `ValuationBackend/assets/bank_logos/sbi.png` | 225 x 225 px | 2,743 bytes | Extracted from `reference_documents/SBI_Valuation_Report_VAL-2026-675N.docx` | **VERIFIED OFFICIAL** |

### Origin Details for SBI Asset:
- **Extraction Source:** Authentic approved SBI valuation report `reference_documents/SBI_Valuation_Report_VAL-2026-675N.docx` (ZIP stream `word/media/image1.png`).
- **Visual Description:** Authentic State Bank of India monogram (blue circular keyhole emblem).
- **Embedded DPI & Resolution:** 225x225 PNG, lossless compression, 2.74 KB.

---

## 4. Bank-by-Bank Verification Status (14 Supported Banks)

| Bank Name | Short Code | Official Asset Status | Production Rendering Mode | Source Document / Action Required |
| :--- | :--- | :--- | :--- | :--- |
| **State Bank of India** | `sbi` | **VERIFIED** | Official PNG Logo + Text | Extracted from authentic reference DOCX |
| **Andhra Pragathi Grameena Bank** | `apgb` | Unverified | **Clean Typographic Header** | Awaiting panel valuer branch letterhead upload |
| **Canara Bank** | `canara` | Unverified | **Clean Typographic Header** | Awaiting official vector asset |
| **Union Bank of India** | `union` | Unverified | **Clean Typographic Header** | Awaiting official vector asset |
| **Punjab National Bank** | `pnb` | Unverified | **Clean Typographic Header** | Awaiting official vector asset |
| **Indian Bank** | `indian` | Unverified | **Clean Typographic Header** | Awaiting official vector asset |
| **Bank of Baroda** | `bob` | Unverified | **Clean Typographic Header** | Awaiting official vector asset |
| **HDFC Bank Ltd** | `hdfc` | Unverified | **Clean Typographic Header** | Awaiting official vector asset |
| **ICICI Bank Ltd** | `icici` | Unverified | **Clean Typographic Header** | Awaiting official vector asset |
| **Axis Bank Ltd** | `axis` | Unverified | **Clean Typographic Header** | Awaiting official vector asset |
| **Kotak Mahindra Bank** | `kotak` | Unverified | **Clean Typographic Header** | Awaiting official vector asset |
| **Central Bank of India** | `central` | Unverified | **Clean Typographic Header** | Awaiting official vector asset |
| **Indian Overseas Bank** | `iob` | Unverified | **Clean Typographic Header** | Awaiting official vector asset |
| **UCO Bank** | `uco` | Unverified | **Clean Typographic Header** | Awaiting official vector asset |

---

## 5. Generator Implementation Logic Audit

The report generator in `ValuationBackend/services/masterDocxGenerator.py` was audited to verify that no synthetic images can ever be inserted into a valuation document:

```python
def get_logo_path(bank_name, base_dir):
    """
    Returns the path to a verified official bank logo if available.
    Never returns unverified or synthetic placeholder graphics.
    If no verified logo exists, returns None to format the bank name cleanly as text.
    """
    logos_dir = os.path.join(base_dir, "assets", "bank_logos")
    b = (bank_name or "").lower()
    
    # Currently verified official bank logos in repository
    if "state bank" in b or "sbi" in b:
        p = os.path.join(logos_dir, "sbi.png")
        if os.path.exists(p):
            return p
            
    # For all other banks, return None until verified official vector/PNG assets are provided
    return None
```

### Typographic Header Fallback Mechanism
When `get_logo_path()` returns `None`:
1. No image run is added to the document.
2. The document displays the bank's uppercase legal title (e.g., `ANDHRA PRAGATHI GRAMEENA BANK`) centered in bold typography (14pt - 16pt), followed by the branch address and district.
3. This complies with standard Indian empanelled valuation report practices where bank letterhead stationery or clean text headers are accepted by credit sanctioning committees.

---

## 6. Audit Verdict

- **Synthetic Logo Removal:** **PASS** (Zero placeholder graphics exist in `ValuationBackend/assets/bank_logos/`).
- **Official Asset Authentication:** **PASS** (SBI logo verified from authentic DOCX).
- **Text-Only Fallback:** **PASS** (Clean typographic layout verified across APGB, Canara, and Union Bank test runs).
- **Production Asset Integrity:** **PASS**.

---

## 5. Public website logos (added 11 Nov 2026)

The public website (`ValuationApp/public/bank-logos/`) shows a logo for every served bank.

| Bank | File | Source | Status |
| :--- | :--- | :--- | :--- |
| State Bank of India | `sbi.png` | Extracted from the authentic SBI reference report (see §3) | **VERIFIED** |
| APGB, Bank of Baroda, Bank of India, Bank of Maharashtra, Canara Bank, Central Bank of India, Indian Bank, Indian Overseas Bank, Karnataka Bank, Punjab National Bank, UCO Bank, Union Bank of India | `apgb.png`, `bob.png`, `boi.png`, `bom.png`, `canara.png`, `cbi.png`, `indian.png`, `iob.png`, `karnataka.png`, `pnb.png`, `uco.png`, `union.png` | Cropped from a single logo collage image supplied by the owner on 11 Nov 2026 (not the banks' original artwork files) | **Supplied by owner — not verified against official files** |

These 12 are used **only on the public website**. They are not used in the bank reports.
Replace each with the bank's official artwork when available (same file name; see `public/bank-logos/README.md`).

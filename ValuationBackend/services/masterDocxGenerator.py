#!/usr/bin/env python3
"""
GCR MASTER DOCX REPORT GENERATOR
Author: Principal Software Architect & Document Automation Specialist
Engine: python-docx high-fidelity reference template populator

Generates 100% faithful bank valuation reports matching the official APGB/SBI reference formats:
- HOUSE APGB NEW FORMET.docx (Independent House)
- APGB APARTMENTS (1).docx (Apartment / Flat)
- OPEN SITE APGB.docx (Open Site / Commercial Plot)
- OPEN AGRICULTURE LAND APGB NEW FORMET.docx (Open Agricultural Land)
"""

import sys
import json
import os
import re
from decimal import Decimal, ROUND_HALF_UP
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

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
            
    # For all other banks, return None until verified official vector/PNG assets are provided by the bank panel
    return None

def number_to_indian_words(num):
    try:
        d = Decimal(str(num).strip().replace(',', ''))
        n = int(d.quantize(Decimal('1'), rounding=ROUND_HALF_UP))
    except Exception:
        return ""
    
    if n == 0:
        return "ZERO"

    units = ["", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN",
             "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN"]
    tens = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"]

    def convert_upto_thousand(val):
        words = []
        if val >= 100:
            words.append(units[val // 100] + " HUNDRED")
            val %= 100
        if val >= 20:
            words.append(tens[val // 10])
            val %= 10
        if val > 0:
            words.append(units[val])
        return " ".join(words)

    parts = []
    crore = n // 10000000
    n %= 10000000
    lakh = n // 100000
    n %= 100000
    thousand = n // 1000
    n %= 1000
    remainder = n

    if crore > 0:
        parts.append(convert_upto_thousand(crore) + (" CRORE" if crore == 1 else " CRORES"))
    if lakh > 0:
        parts.append(convert_upto_thousand(lakh) + " LAKH" if lakh == 1 else convert_upto_thousand(lakh) + " LAKHS")
    if thousand > 0:
        parts.append(convert_upto_thousand(thousand) + " THOUSAND")
    if remainder > 0:
        parts.append(convert_upto_thousand(remainder))

    return " ".join(parts).strip()

def format_inr(val):
    try:
        d = Decimal(str(val).strip().replace(',', ''))
        n = int(d.quantize(Decimal('1'), rounding=ROUND_HALF_UP))
        s = str(n)
        if len(s) <= 3:
            return s
        last3 = s[-3:]
        rest = s[:-3]
        groups = []
        while len(rest) > 2:
            groups.insert(0, rest[-2:])
            rest = rest[:-2]
        if rest:
            groups.insert(0, rest)
        return ",".join(groups) + "," + last3
    except Exception:
        return str(val)

def generate_master_docx(case_data, output_path, base_dir):
    # Bank formats built from the bank's own sample reports (exact layout, values filled in)
    exact = _exact_bank_format(case_data, output_path)
    if exact:
        return exact
    p_details = case_data.get("propertyDetails", {}) or {}
    valuation = case_data.get("valuation", {}) or {}
    category = (p_details.get("propertyType") or case_data.get("propertyType") or "Independent House").strip()
    
    # Select authoritative reference template
    cat_lower = category.lower()
    if "apartment" in cat_lower or "flat" in cat_lower:
        tpl_name = "apartment_template.docx"
    elif "agriculture" in cat_lower:
        tpl_name = "agriculture_template.docx"
    elif "open site" in cat_lower or "plot" in cat_lower:
        tpl_name = "open_site_template.docx"
    else:
        tpl_name = "house_template.docx"
        
    tpl_path = os.path.join(base_dir, "services", "templates", tpl_name)
    if not os.path.exists(tpl_path):
        raise FileNotFoundError(f"Template not found at {tpl_path}")
        
    doc = Document(tpl_path)
    
    # Extract Case Values
    # Official file number (GCR/KDP/2026/11/0001) when present; older cases fall back to the internal id
    case_id = str(case_data.get("fileNumber") or case_data.get("id") or "2605115")
    client_name = str(case_data.get("clientName") or "Sri Valued Client")
    father_name = str(case_data.get("clientFatherName") or p_details.get("fathersName") or "Late Sri Father")
    bank_name = (case_data.get("bankName") or "ANDHRA PRADESH GRAMEENA BANK").upper()
    bank_branch = str(case_data.get("bankBranch") or "POLICE LANE BRANCH, KADAPA").upper()
    bank_district = str(case_data.get("bankDistrict") or "Y.S.R").upper()
    insp_date = str(case_data.get("inspectionDate") or "23-05-2026")
    val_date = str(p_details.get("valuationDate") or case_data.get("createdAt") or "25-05-2026")
    if "T" in val_date:
        val_date = val_date.split("T")[0]
        
    deed_no = str(p_details.get("deedNo") or "4004")
    deed_year = str(p_details.get("deedYear") or "2016")
    deed_str = f"{deed_no}/{deed_year}" if deed_year and deed_year not in deed_no else deed_no
    survey_no = str(p_details.get("surveyNo") or "343")
    door_no = str(p_details.get("doorNo") or "44/37-4-15")
    plot_no = str(p_details.get("plotNo") or "22(part) & 23(part)")
    ward_no = str(p_details.get("wardNo") or "44")
    net_extent = str(p_details.get("netExtent") or "2.83 Cents")
    bldg_age = str(p_details.get("buildingAge") or "5")
    road_width = str(p_details.get("roadWidth") or "30 ft")
    road_type = str(p_details.get("roadType") or "Metal Road")
    plot_type = str(p_details.get("plotType") or "Intermediary Plot")
    structure_type = str(p_details.get("structureType") or "RCC Framed Structure")
    flooring_type = str(p_details.get("flooringType") or "Vitrified Tiles")
    
    # Financial figures
    fmv = valuation.get("fairMarketValue") or 8714000
    fmv_words = number_to_indian_words(fmv)
    rv = valuation.get("realizableValue") or int(round(fmv * 0.90))
    dv = valuation.get("distressSaleValue") or int(round(fmv * 0.80))
    land_val = valuation.get("landValue") or int(round(fmv * 0.45))
    bldg_val = valuation.get("netStructureValue") or int(round(fmv * 0.45))

    # Extract dynamic policy percentages
    policy_rates = valuation.get("policyRates") or {}
    realizable_pct = int(round(policy_rates.get("realizableRate", (rv / fmv) if fmv else 0.90) * 100))
    distress_pct = int(round(policy_rates.get("distressRate", (dv / fmv) if fmv else 0.80) * 100))

    # Known borrower targets across all 4 templates
    known_borrowers = [
        "Sri M. Subba Naik",
        "P . Ravindra Reddy",
        "P. Ravindra Reddy",
        "Shaik. Sirabhanu",
        "Sirabhanu",
        "C. Linga Reddy",
        "Linga Reddy"
    ]
    known_fathers = [
        "Sri M. Jamla Naik",
        "Sri M. Jamla Naik (late)",
        "P. Rami Reddy",
        "Mahaboob Basha",
        "C. Pedda Reddaiah"
    ]
    known_deeds = ["4004/2016", "259/2022", "4968/2025", "628/2002"]
    known_surveys = ["343", "347/2", "350/4", "492/2B", "777-3P5"]
    known_doors = ["44/37-4-15", "44/34-3-17", "11/182", "57/257-9-2-18"]

    # Replacement helper function across paragraph runs
    def apply_text_replacements(p):
        txt = p.text
        if not txt.strip():
            return
            
        # Bank name
        if "ANDHRA PRADESH GRAMEENA BANK" in txt or "STATE BANK OF INDIA" in txt:
            p.text = bank_name
            if p.runs:
                p.runs[0].font.bold = True
                p.runs[0].font.size = Pt(14)
            return

        # District & Branch
        if "District" in txt and ("Branch" in txt or "Y.S.R" in txt or "Y S R" in txt):
            p.text = f"District : {bank_district}              Branch : {bank_branch}"
            return
        elif txt.strip().startswith("Branch :") or txt.strip().startswith("Branch:"):
            p.text = f"Branch :  {bank_branch}"
            return

        # Date
        if "Date  :" in txt or "Date :" in txt:
            p.text = re.sub(r'(Date\s*:\s*)[\d\-]+', r'\1' + val_date, txt)
            return

        # Borrower replacement
        for kb in known_borrowers:
            if kb in txt:
                txt = txt.replace(kb, client_name)
        for kf in known_fathers:
            if kf in txt:
                txt = txt.replace(kf, father_name)
        for kd in known_deeds:
            if kd in txt:
                txt = txt.replace(kd, deed_str)
        for ks in known_surveys:
            if ks in txt:
                txt = txt.replace(ks, survey_no)
        for kdr in known_doors:
            if kdr in txt:
                txt = txt.replace(kdr, door_no)

        # Financial values
        if "87,14,500" in txt:
            txt = txt.replace("87,14,500", format_inr(fmv))
        if "87,14,000" in txt:
            txt = txt.replace("87,14,000", format_inr(fmv))
        if "45,08,000" in txt:
            txt = txt.replace("45,08,000", format_inr(fmv))
        if "14,07,000" in txt:
            txt = txt.replace("14,07,000", format_inr(fmv))
        if "20,40,000" in txt:
            txt = txt.replace("20,40,000", format_inr(fmv))

        if "RUPEES EIGHTY SEVEN LAKHS" in txt:
            txt = f"                                (RUPEES {fmv_words} ONLY)"
        elif "RUPEES" in txt and "ONLY" in txt and len(txt) < 120:
            txt = f"                                (RUPEES {fmv_words} ONLY)"

        if "78,42,000" in txt:
            txt = txt.replace("78,42,000", format_inr(rv))
        if "69,71,000" in txt:
            txt = txt.replace("69,71,000", format_inr(dv))

        # Dynamic policy percentage replacements in table labels
        if "Realizable Value" in txt and "of FMV" in txt:
            txt = re.sub(r'\(\s*\d+\s*%\s*of\s*FMV\s*\)', f'({realizable_pct} % of FMV)', txt)
        if "Distress" in txt and "of FMV" in txt:
            txt = re.sub(r'\(\s*\d+\s*%\s*of\s*FMV\s*\)', f'({distress_pct} % of FMV)', txt)

        if txt != p.text:
            p.text = txt

    # --- 1. PARAGRAPHS REPLACEMENT ---
    for p in doc.paragraphs:
        # File number
        if "FILE NO:" in p.text or "File No:-" in p.text or "FILE NO –" in p.text:
            p.text = re.sub(r'(FILE NO[:\s–-]+)\s*[\w\-]+', r'\1 ' + case_id, p.text, flags=re.IGNORECASE)
        else:
            apply_text_replacements(p)

    # Insert Dynamic Bank Logo at top
    logo_path = get_logo_path(bank_name, base_dir)
    if logo_path:
        for p in doc.paragraphs[:15]:
            if bank_name in p.text or "VALUATION REPORT" in p.text:
                logo_para = p.insert_paragraph_before()
                logo_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
                run = logo_para.add_run()
                run.add_picture(logo_path, width=Inches(1.0))
                break

    # --- 2. TABLE REPLACEMENTS ---
    for t in doc.tables:
        for r in t.rows:
            for c in r.cells:
                for p in c.paragraphs:
                    apply_text_replacements(p)
                # Cell-specific replacements
                if "23-05-2026" in c.text:
                    c.text = c.text.replace("23-05-2026", insp_date)
                if "25-05-2026" in c.text:
                    c.text = c.text.replace("25-05-2026", val_date)
                if "40,32,750" in c.text:
                    c.text = c.text.replace("40,32,750", format_inr(land_val))
                if "34,81,750" in c.text:
                    c.text = c.text.replace("34,81,750", format_inr(bldg_val))
                if "20’0” Wide Road" in c.text:
                    c.text = c.text.replace("20’0” Wide Road", f"{road_width} {road_type}")

    # --- 3. DYNAMIC MULTI-FLOOR PLINTH AREA TABLE (TABLE 4 IN HOUSE TEMPLATE) ---
    floors = p_details.get("siteValue", {}).get("floors", [])
    if floors and len(doc.tables) > 4:
        t_floor = doc.tables[4]
        if len(t_floor.rows) >= 3 and "Ground" in t_floor.rows[1].cells[1].text:
            for f_idx, fl in enumerate(floors):
                fl_name = fl.get("label") or f"Floor {f_idx + 1}"
                fl_area = str(fl.get("value") or fl.get("plinthArea") or "750 Sqft")
                fl_rate = str(fl.get("rate") or "2500")
                if f_idx + 1 < len(t_floor.rows) - 1:
                    row = t_floor.rows[f_idx + 1]
                    row.cells[1].text = fl_name
                    row.cells[2].text = fl_area
                    row.cells[5].text = f"Rs {fl_rate}/-"

    # --- 4. SITE PHOTOGRAPHS ---
    # Every picture in the template's photo pages is a sample photo from another case: each one is
    # replaced by this case's photo, and any left over is removed (never printed in this report).
    import base64
    def _photo_bytes(item):
        src = item.get("url") if isinstance(item, dict) else item
        if not isinstance(src, str) or not src.startswith("data:image"):
            return None
        try:
            return base64.b64decode(re.sub(r'^data:image\/\w+;base64,', '', src))
        except Exception:
            return None
    photos = [b for b in (_photo_bytes(x) for x in (case_data.get("sitePhotos") or [])) if b]
    R_EMBED = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed'
    W_P = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'
    from PIL import Image as _Img
    import io as _io
    def _is_case_picture(blob):
        # photos (JPEG) and large pictures such as a sample location map; small logos stay
        if blob[:3] == b'\xff\xd8\xff':
            return True
        try:
            w, h = _Img.open(_io.BytesIO(blob)).size
            return w >= 600 and h >= 400
        except Exception:
            return False
    photo_paras = [el for el in doc.element.body.iter(W_P) if el.xpath('.//a:blip')
                   and any(_is_case_picture(doc.part.related_parts[b.get(R_EMBED)].blob)
                           for b in el.xpath('.//a:blip') if b.get(R_EMBED) in doc.part.related_parts)]
    for idx, el in enumerate(photo_paras):
        if idx < len(photos):
            for b in el.xpath('.//a:blip'):
                rid = b.get(R_EMBED)
                if rid in doc.part.related_parts:
                    doc.part.related_parts[rid]._blob = photos[idx]
        else:
            el.getparent().remove(el)

    sys.path.insert(0, os.path.join(base_dir, "services", "reports"))
    from fill_report import drop_unused_images
    drop_unused_images(doc)
    doc.save(output_path)
    return output_path

def _branch_for_job(case_data, output_path):
    """The branch's own letterhead picture (saved to a temp file) and valuer, if it has them."""
    import base64, re as _re
    out = {}
    data_url = case_data.get("branchLetterhead") or ""
    m = _re.match(r"^data:image/(png|jpe?g);base64,(.+)$", data_url, _re.S)
    if m:
        path = output_path + (".letterhead.png" if m.group(1) == "png" else ".letterhead.jpg")
        with open(path, "wb") as f:
            f.write(base64.b64decode(m.group(2)))
        out["letterhead"] = path
    valuer = case_data.get("branchValuer") or {}
    if (valuer.get("name") or "").strip():
        out["valuer"] = valuer
    return out


def _exact_bank_format(case_data, output_path):
    """Banks with their own installed format (APGB, Bank of Baroda…) use services/reports
    (the bank's exact template). Other banks keep the standard generator."""
    reports_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "reports")
    sys.path.insert(0, reports_dir)
    import registry, fill_report
    bank_module = registry.module_for(case_data)
    if bank_module is None:
        return None
    try:
        job, temps = bank_module.build(case_data, output_path)
    except NotImplementedError as err:
        print(f"Note: {err}; using the standard generator", file=sys.stderr)
        return None
    job_path = output_path + ".job.json"
    branch = _branch_for_job(case_data, output_path)
    if branch:
        job["branch"] = branch
        if branch.get("letterhead"):
            temps = list(temps) + [branch["letterhead"]]
    with open(job_path, "w", encoding="utf-8") as f:
        json.dump(job, f)
    try:
        fill_report.main(job_path)
    finally:
        for t in temps + [job_path]:
            try:
                os.unlink(t)
            except OSError:
                pass
    return output_path


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: masterDocxGenerator.py <case_json_file> <output_docx_file>", file=sys.stderr)
        sys.exit(1)
        
    case_json_path = sys.argv[1]
    output_docx_path = sys.argv[2]
    script_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(script_dir)
    
    with open(case_json_path, "r", encoding="utf-8") as f:
        case_data = json.load(f)
        
    generate_master_docx(case_data, output_docx_path, backend_dir)
    print(f"SUCCESS: Generated {output_docx_path}")

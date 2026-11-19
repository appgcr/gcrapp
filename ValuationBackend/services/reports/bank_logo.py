"""Bank logo on page one, above the report title (the SBI, BoB, PNB… samples already carry theirs).
Logos are the banks' own, taken from their websites (white lettering recoloured to the bank's blue
where the site only had a version for a dark header: Canara, APGB)."""
import os
import re
import copy
from docx.shared import Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH

HERE = os.path.dirname(os.path.abspath(__file__))
LOGOS = {'apgb': 'apgb.png', 'canara': 'canara.png', 'union': 'union.png', 'cbi': 'cbi.png', 'uco': 'uco.png', 'bom': 'bom.png'}
TITLE = re.compile(r'VALUATION REPORT|VALUATION OF PROPERTY|REPORT ON VALUATION', re.I)
MARK = 'gcr-bank-logo'


def add_logo(doc, bank, height_cm=1.3):
    """Insert the bank's logo in its own centred line just above the first-page title. Safe to run twice."""
    if bank not in LOGOS:
        return False
    body = doc.element.body
    if any(MARK in (el.get('descr') or '') for el in body.iter() if el.tag.endswith('}docPr')):
        return False
    paras = doc.paragraphs[:30]  # page one only
    target = next((p for p in paras if TITLE.search(p.text) and len(p.text.strip()) < 60), None)
    if target is None:  # e.g. Canara agriculture (title further down): the line before "To"
        target = next((p for p in paras if re.match(r'To\b', p.text.strip())), None)
    if target is None:
        return False
    new = target.insert_paragraph_before()
    new.alignment = WD_ALIGN_PARAGRAPH.CENTER
    pf = new.paragraph_format
    pf.space_before, pf.space_after, pf.left_indent, pf.first_line_indent = Cm(0), Cm(0.1), Cm(0), Cm(0)
    run = new.add_run()
    run.add_picture(os.path.join(HERE, 'logos', LOGOS[bank]), height=Cm(height_cm))
    for el in new._p.iter():
        if el.tag.endswith('}docPr'):
            el.set('descr', MARK)
    return True

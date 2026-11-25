"""Bank logo on page one, on the left beside the report title block (the SBI, BoB, PNB… samples already carry theirs).
Logos are the banks' own, taken from their websites (white lettering recoloured to the bank's blue
where the site only had a version for a dark header: Canara, APGB)."""
import os
import re
import copy
from docx.shared import Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

HERE = os.path.dirname(os.path.abspath(__file__))
LOGOS = {'apgb': 'apgb.png', 'canara': 'canara.png', 'union': 'union_en.png', 'cbi': 'cbi.png', 'uco': 'uco.png', 'bom': 'bom.png', 'indian': 'indian.png', 'shriram': 'shriram.png'}
TITLE = re.compile(r'VALUA?TION REPORT|VALUATION OF PROPERTY|REPORT ON VALUATION', re.I)
MARK = 'gcr-bank-logo'
# Forms whose title block is shorter than the usual title + bank name + District + Branch:
# (box width, box height, block height) in cm, so the logo stays within those lines
BLOCK = {'shriram': (4.2, 1.2, 1.2)}   # 'VALUTION REPORT' + 'Valuation Date' only


def add_logo(doc, bank, height_cm=1.3):
    """Insert the bank's logo on page one, then float it to the left of the title block. Safe to run twice."""
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
    float_left(doc, *BLOCK.get(bank, ()))
    return True


EMU = 360000  # per cm
BOX_W, BOX_H = 4.2, 2.4   # the free space left of the centred title lines (cm)
BLOCK_H = 3.0             # height of title + bank name + District + Branch lines (cm)


def float_left(doc, box_w=BOX_W, box_h=BOX_H, block_h=BLOCK_H):
    """Move the logo out of its own centred line into the empty space on the left of the title block
    (title, bank name, District, Branch), floating so the centred text does not move. Safe to run twice."""
    body = doc.element.body
    inline = next((el for el in body.iter() if el.tag.endswith('}inline')
                   and any(MARK in (d.get('descr') or '') for d in el.iter() if d.tag.endswith('}docPr'))), None)
    if inline is None:
        return False
    logo_p = inline
    while logo_p is not None and not logo_p.tag.endswith('}p'):
        logo_p = logo_p.getparent()
    title = logo_p.getnext()
    while title is not None and not (title.tag.endswith('}p') and ''.join(t.text or '' for t in title.iter() if t.tag.endswith('}t')).strip()):
        title = title.getnext()
    if title is None:
        return False
    ext = next(el for el in inline if el.tag.endswith('}extent'))
    cx, cy = int(ext.get('cx')), int(ext.get('cy'))
    scale = min(box_w * EMU / cx, box_h * EMU / cy)
    cx, cy = int(cx * scale), int(cy * scale)
    for el in inline.iter():  # the picture's own size inside the graphic
        if el.tag.endswith('}ext') and el.get('cx'):
            el.set('cx', str(cx)); el.set('cy', str(cy))
    doc_pr = next(el for el in inline if el.tag.endswith('}docPr'))
    graphic = next(el for el in inline if el.tag.endswith('}graphic'))
    top = max(0, int((block_h * EMU - cy) / 2))
    anchor = parse_xml(
        f'<wp:anchor {nsdecls("wp", "a")} distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="251659264" '
        f'behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">'
        f'<wp:simplePos x="0" y="0"/>'
        f'<wp:positionH relativeFrom="margin"><wp:posOffset>0</wp:posOffset></wp:positionH>'
        f'<wp:positionV relativeFrom="paragraph"><wp:posOffset>{top}</wp:posOffset></wp:positionV>'
        f'<wp:extent cx="{cx}" cy="{cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>'
        f'<wp:cNvGraphicFramePr/></wp:anchor>')
    anchor.insert(6, doc_pr)              # wrapNone, then docPr, cNvGraphicFramePr, graphic
    anchor.append(graphic)
    drawing = inline.getparent()
    drawing.replace(inline, anchor)
    run = drawing.getparent()
    first_run = next((r for r in title if r.tag.endswith('}r')), None)
    if first_run is not None:
        first_run.addprevious(run)
    else:
        title.append(run)
    logo_p.getparent().remove(logo_p)
    from docx.shared import Pt
    from docx.text.paragraph import Paragraph
    pf = Paragraph(title, None).paragraph_format
    if not pf.space_before or pf.space_before < Pt(6):
        pf.space_before = Pt(6)  # a little air between the letterhead and the title
    return True

"""
Branch letterhead and valuer details.

Every bank format is the Kadapa office's sample, so its letterhead (valuer name, phones, address,
panel banks, IIV number) is typed at the top of the first page and of some annexure pages.
When a branch has uploaded its own letterhead picture, each of those blocks is replaced by the
picture; the FILE NO on the last letterhead line is kept. When a branch has its own valuer, the
valuer's name, father's name, qualification, IIV number, phones and address inside the report
text are changed too. Branches without an upload keep the Kadapa letterhead exactly as it is.
"""
import re

from docx.oxml.ns import qn

START = re.compile(r'^\s*((Sri|Er)\.?\s*)?G(ouru)?\.?\s*\w+\s*Reddy', re.I)
IIV = re.compile(r'Indian\s+Institution\s+of\s+Valuers\s*F\s*[–-]\s*\d+\.?', re.I)
TABLE_HEAD = re.compile(r'Approved\s+Valuer|Panel\s+Valuer', re.I)


def _text(el):
    return ''.join(t.text or '' for t in el.iter(qn('w:t')))


def find_blocks(doc):
    """[(elements, last_paragraph_or_None)] — each letterhead block in the body."""
    body = list(doc.element.body)
    blocks, i = [], 0
    while i < len(body):
        el = body[i]
        tag = el.tag.rsplit('}', 1)[1]
        txt = _text(el)
        if tag == 'tbl' and i < len(body) and START.search(txt) and TABLE_HEAD.search(txt):
            blocks.append(([el], None))
        elif tag == 'p' and START.search(txt) and ('Cell' in txt or 'Tech' in txt or 'MISTE' in txt):
            for j in range(i + 1, min(i + 14, len(body))):
                if body[j].tag.endswith('}p') and IIV.search(_text(body[j])):
                    blocks.append((body[i:j], body[j]))
                    i = j
                    break
        i += 1
    return blocks


def apply_letterhead(doc, image_path):
    """Swap every letterhead block for the branch's letterhead picture."""
    from docx.shared import Emu
    from docx_tools import para_text, replace_span
    from docx.text.paragraph import Paragraph
    sec = doc.sections[0]
    width = Emu(sec.page_width - sec.left_margin - sec.right_margin)
    n = 0
    for els, last in find_blocks(doc):
        first = els[0]
        from docx.oxml import OxmlElement
        new_p = OxmlElement('w:p')
        first.addprevious(new_p)        # works before a paragraph or a table letterhead
        pic = Paragraph(new_p, doc._body)
        pic.add_run().add_picture(image_path, width=width)
        for el in els:
            el.getparent().remove(el)
        if last is not None:
            p = Paragraph(last, doc._body)
            m = IIV.search(para_text(p))
            if m:
                replace_span(p, m.group(0), '')
            if not para_text(p).strip():
                last.getparent().remove(last)
            else:
                p.alignment = 2  # FILE NO stays, on the right under the letterhead
                for r in p.runs:   # drop the spacing that pushed it right inside the old block
                    if r.text and not r.text.strip():
                        r.text = ''
                if p.runs:
                    p.runs[0].text = p.runs[0].text.lstrip()
        n += 1
    return n


# ------------------------------------------------------------------ valuer details in the text
NAME = re.compile(r'G(?:ouru)?\s*\.?\s*(?:Neelakanta|Chanikya)\s*Reddy', re.I)
FATHER = re.compile(r'((?:Son\s*/\s*Daughter|son|daughter|wife)\s+of\s+)(?:Sri\.?\s*)?G(?:ouru)?\s*\.?\s*(?:Nagi|Neelakanta)\s+Reddy', re.I)
QUAL = re.compile(r'B\.\s*Tech[\s.,]*MISTE\s*\.?|B\.\s*Tech\.,\s*M\.Sc\.,\s*M\.I\.E\.', re.I)
IIV_NO = re.compile(r'F\s*[–-]\s*13622')
CELL = re.compile(r'9440164412')
OFFICE = re.compile(r'9052589896|9440048100|8341341353|8919208137|8897222387|9100343034|6303028342')
OFFICE_ADDR = re.compile(r'Door\s*No\s*:?\s*-?\s*21/659.*$', re.I | re.S)
ADDRESS = re.compile(r'(Address of the valuer\s*:\s*)(.*)$', re.I | re.S)


def _same_case(old, new):
    return new.upper() if old.isupper() else new


def apply_valuer(doc, v):
    """Put this branch's valuer into the report text (template text only — run before filling)."""
    from docx_tools import all_paragraphs, para_text, replace_span
    v = {k: (str(v.get(k) or '').strip()) for k in ('name', 'fatherName', 'qualification', 'iivNo', 'cell', 'office', 'address')}
    if not v['name']:
        return 0
    rules = [(FATHER, lambda m: m.group(1) + _same_case(m.group(0)[len(m.group(1)):], v['fatherName']) if v['fatherName'] else None),
             (NAME, lambda m: _same_case(m.group(0), v['name'])),
             (QUAL, lambda m: v['qualification'] or None),
             (IIV_NO, lambda m: v['iivNo']),
             (CELL, lambda m: v['cell'] or None),
             (OFFICE, lambda m: v['office'] or None)]
    n = 0
    for p in all_paragraphs(doc):
        for rx, make in rules:
            for m in list(rx.finditer(para_text(p))):
                new = make(m)
                if new is None or new == m.group(0) or m.group(0) not in para_text(p):
                    continue
                replace_span(p, m.group(0), new)
                n += 1
        if v['address']:
            m = ADDRESS.search(para_text(p))
            if m and m.group(2).strip():
                replace_span(p, m.group(2), v['address'])
                n += 1
            m = OFFICE_ADDR.search(para_text(p))
            if m:
                replace_span(p, m.group(0), v['address'])
                n += 1
    return n


def apply_branch(doc, branch):
    """branch = {'letterhead': picture path or '', 'valuer': {...}} from the report job."""
    if not branch:
        return
    if branch.get('letterhead'):   # first: the blocks are found by the Kadapa valuer's name
        apply_letterhead(doc, branch['letterhead'])
    apply_valuer(doc, branch.get('valuer') or {})

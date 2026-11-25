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


SEP = re.compile(r'(?<=\S)([  ]*\t[\s ]*|[  ]{3,})(?=\S)')


SAMPLE = {'{{fileNo}}': 'GOURU/KDP/2026/11/0000', '{{engineerInitials}}': 'GCR Field Engineer'}


def _width_cm(text, size_pt, em=0.55):
    """Rough printed width of bold serif text (letterhead fonts), generous so nothing wraps."""
    for k, v in SAMPLE.items():
        text = text.replace(k, v)
    text = re.sub(r'\{\{[^}]*\}\}', 'XXXXXXXXXX', text)
    return len(text) * size_pt * em * 0.03528


def tidy_letterhead(doc):
    """Line up the right-hand column of the letterhead (Cell, Off, Door No, address, engineer, FILE NO).
    The samples pushed each line into place with a different mix of tabs and spaces, so the column
    zig-zags and a long FILE NO wraps. Each line gets one tab to the same left-aligned stop, placed so
    the longest right-hand line ends at the margin. (Left stops, not right ones: the in-app report
    viewer does not support right-aligned tabs.)"""
    from docx.shared import Cm
    from docx.enum.text import WD_TAB_ALIGNMENT
    from docx.text.paragraph import Paragraph
    sec = doc.sections[0]
    text_w = (sec.page_width - sec.left_margin - sec.right_margin) / 360000
    n = 0
    for els, last in find_blocks(doc):
        lines = []
        for el in els + ([last] if last is not None else []):
            if not el.tag.endswith('}p'):
                continue
            p = Paragraph(el, doc._body)
            runs = list(p.runs)
            text = ''.join(r.text for r in runs)
            if len(text) > 160:   # a whole letterhead squeezed into one line (spaced, not tabbed): leave it
                continue
            # the real gap between the two columns is the widest one (a sample may have a stray tab
            # inside the bank list, e.g. 'Canara Bank,<tab>PNB')
            gaps = list(SEP.finditer(text))
            m = max(gaps, key=lambda g: (len(g.group(0).expandtabs(8)), g.start())) if gaps else None  # tie → the later gap
            if not m:
                for r in reversed(p.runs):  # left text only: drop trailing tabs/spaces that could wrap
                    stripped = r.text.rstrip()
                    if stripped:
                        r.text = stripped
                        break
                    r.text = ''
                continue
            a, b = m.span()
            pos = 0
            for r in runs:  # stray tabs on the left side become spaces (only one tab per line)
                e = pos + len(r.text)
                if pos < a and '\t' in r.text[:max(0, a - pos)]:
                    r.text = r.text[:max(0, a - pos)].replace('\t', ' ') + r.text[max(0, a - pos):]
                pos = e
            text = ''.join(r.text for r in runs)
            pos = 0
            right_size = 0
            for r in runs:  # replace the separator with one tab, keeping each run's formatting
                t = r.text
                s0, e = pos, pos + len(t)
                pos = e
                if e > b and r.font.size:
                    right_size = max(right_size, r.font.size.pt)
                if e <= a or s0 >= b:
                    continue
                keep_before = t[:max(0, a - s0)]
                keep_after = t[max(0, b - s0):] if b < e else ''
                r.text = keep_before + ('\t' if s0 <= a < e else '') + keep_after
            for r in reversed(p.runs):  # no trailing spaces after the right-hand text
                stripped = r.text.rstrip()
                if stripped:
                    r.text = stripped
                    break
                r.text = ''
            left, right = ''.join(r.text for r in p.runs).split('\t', 1)
            lines.append((p, left, right, right_size or 11))
        if not lines:
            continue
        # The FILE NO line has no size of its own in some samples and prints larger than the rest
        # of the letterhead, so it wraps: give it the letterhead's usual size
        from collections import Counter
        from docx.shared import Pt
        def eff(p, r):
            if r.font.size:
                return r.font.size.pt
            return p.style.font.size.pt if p.style is not None and p.style.font.size else 11
        sizes = Counter(eff(p, r) for p, _, _, _ in lines if p._p is not last for r in p.runs if r.text.strip())
        usual = sizes.most_common(1)[0][0] if sizes else 11
        if last is not None:
            for p, _, _, _ in lines:
                if p._p is last:
                    for r in p.runs:
                        r.font.size = Pt(usual)

        def sides(p):
            style_pt = p.style.font.size.pt if p.style is not None and p.style.font.size else 12
            lw = rw = 0.0
            right = False
            for r in p.runs:
                pt = r.font.size.pt if r.font.size else style_pt
                wide = 1.12 if re.search(r'Gothic|Arial|Verdana|Tahoma', r.font.name or '', re.I) else 1.0
                pt *= wide
                t = r.text
                if '\t' in t and not right:
                    before, after = t.split('\t', 1)
                    lw += _width_cm(before, pt, 0.47)
                    rw += _width_cm(after, pt, 0.52)
                    right = True
                elif right:
                    rw += _width_cm(t, pt, 0.52)
                else:
                    lw += _width_cm(t, pt, 0.47)
            return lw, rw
        main = [p for p, _, _, _ in lines if p._p is not last]
        file_line = next((p for p, _, _, _ in lines if p._p is last), None)
        widths = [sides(p) for p in main] or [sides(file_line)]
        left_w = max(w[0] for w in widths)
        right_w = max(w[1] for w in widths)
        # right column as far right as the longest right-hand line allows, but clear of the left text
        stop = min(max(text_w - right_w - 0.1, left_w + 0.3), text_w - 4.0)
        stop_of = {p._p: stop for p in main}
        if file_line is not None:
            # best: one column for every line, FILE NO included, when the left text leaves room
            flw, frw = sides(file_line)
            together = text_w - max(right_w, frw) - 0.1
            if together >= max(left_w, flw) + 0.3:
                stop = together
                stop_of = {p._p: stop for p in main}
        if file_line is not None:
            # FILE NO: same column when it fits; else its own stop (ending at the margin), a size smaller if needed
            for pt in (usual, 11, 10.5, 10):
                if pt != usual:
                    for r in file_line.runs:
                        r.font.size = Pt(pt)
                lw, rw = sides(file_line)
                if stop + rw <= text_w - 0.1:
                    stop_of[file_line._p] = stop
                    break
                if lw + 0.3 + rw <= text_w - 0.1:
                    stop_of[file_line._p] = text_w - rw - 0.1
                    break
            else:
                stop_of[file_line._p] = max(lw + 0.3, text_w - rw - 0.1)
        for p, _, _, _ in lines:
            indent = (p.paragraph_format.left_indent or 0) / 360000
            stops = p.paragraph_format.tab_stops
            for _ in list(stops):
                del stops[0]
            stops.add_tab_stop(Cm(stop_of[p._p] - indent), WD_TAB_ALIGNMENT.LEFT)
            n += 1
    return n

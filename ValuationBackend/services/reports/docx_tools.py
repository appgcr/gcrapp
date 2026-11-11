"""
Small helpers for editing Word files without changing their look.

Word splits text into "runs" (pieces with the same formatting). These helpers replace
text across runs while keeping the formatting of the run where the text starts, so the
bank's original layout, fonts, tabs and spacing stay exactly as they were.
"""
import copy
import re
from docx.oxml.ns import qn

TAG_RE = re.compile(r'\{\{\s*([\w.]+)\s*\}\}')


def para_text(p):
    return ''.join(r.text for r in p.runs)


def replace_span(p, old, new, occurrence=1):
    """Replace the n-th occurrence of `old` inside paragraph p (may span several runs)."""
    runs = p.runs
    full = ''.join(r.text for r in runs)
    start = -1
    for _ in range(occurrence):
        start = full.find(old, start + 1)
        if start < 0:
            return False
    end = start + len(old)
    pos = 0
    first = True
    for r in runs:
        t = r.text
        a, b = pos, pos + len(t)
        pos = b
        if b <= start or a >= end:
            continue
        s = max(start - a, 0)
        e = min(end - a, len(t))
        if first:
            r.text = t[:s] + new + t[e:]
            first = False
        else:
            r.text = t[:s] + t[e:]
    return True


def set_para_text(p, text):
    """Replace all text in a paragraph, keeping the first text run's formatting."""
    runs = [r for r in p.runs if r.text]
    if not runs:
        if p.runs:
            p.runs[0].text = text
        else:
            p.add_run(text)
        return
    runs[0].text = text
    for r in runs[1:]:
        r.text = ''


def unique_cells(row):
    seen, out = [], []
    for c in row.cells:
        if c._tc in seen:
            continue
        seen.append(c._tc)
        out.append(c)
    return out


def cell_at(table, r, c):
    """Cell by row and *grid* column index (as listed by the inspection script)."""
    return table.rows[r].cells[c]


def set_cell(cell, *texts):
    """Put texts into the cell's paragraphs (one per paragraph); extra paragraphs are removed."""
    paras = cell.paragraphs
    for i, t in enumerate(texts):
        if i < len(paras):
            set_para_text(paras[i], t)
        else:
            cell.add_paragraph(t)
    for p in paras[len(texts):]:
        p._element.getparent().remove(p._element)


def textbox_paragraphs(doc):
    """Paragraphs inside text boxes (front-page boxes such as 'Valuation : Rs …')."""
    from docx.text.paragraph import Paragraph
    for box in doc.element.body.iter(qn('w:txbxContent')):
        for p in box.iter(qn('w:p')):
            yield Paragraph(p, doc._body)


def all_paragraphs(doc):
    """Every paragraph in the document body, tables, headers and footers."""
    def walk(container):
        for p in container.paragraphs:
            yield p
        for t in container.tables:
            for row in t.rows:
                for c in unique_cells(row):
                    yield from walk(c)
    yield from walk(doc)
    yield from textbox_paragraphs(doc)
    for s in doc.sections:
        for part in (s.header, s.footer, s.first_page_header, s.first_page_footer):
            try:
                yield from walk(part)
            except Exception:
                pass


def find_para(doc, contains, nth=1):
    n = 0
    for p in doc.paragraphs:
        if contains in para_text(p):
            n += 1
            if n == nth:
                return p
    raise KeyError(f'paragraph not found: {contains!r}')


def body_index(doc, contains):
    """Index (in body children) of the first paragraph containing text."""
    for i, el in enumerate(doc.element.body.iterchildren()):
        if el.tag == qn('w:p'):
            txt = ''.join(t.text or '' for t in el.iter(qn('w:t')))
            if contains in txt:
                return i
    raise KeyError(contains)


def clone_row_after(row_el):
    new = copy.deepcopy(row_el)
    row_el.addnext(new)
    return new

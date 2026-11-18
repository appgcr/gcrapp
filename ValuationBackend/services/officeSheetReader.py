"""Read the filled GOURU VALUATION – OFFICE sheet (.docx) → its table as rows of cells (JSON on stdout).

Each cell is { "text": "...", "marked": ["HOUSE", ...] } where "marked" lists words the engineer
picked by formatting them (bold / highlight / underline / colour) or by a tick (✓ ✔ √ ☑ ✗ X) next to them.
Usage: python3 officeSheetReader.py <file.docx>
"""
import json
import re
import sys

import docx
from docx.oxml.ns import qn

TICKS = re.compile(r'[✓✔√☑■●★]|\(\s*[xX✓]\s*\)|\[\s*[xX✓]\s*\]')


def run_marked(run, base_bold):
    rpr = run._r.rPr
    if rpr is None:
        return False
    if rpr.find(qn('w:highlight')) is not None or rpr.find(qn('w:shd')) is not None:
        return True
    if rpr.find(qn('w:u')) is not None:
        return True
    color = rpr.find(qn('w:color'))
    if color is not None and (color.get(qn('w:val')) or '').lower() not in ('', 'auto', '000000'):
        return True
    if run.bold and not base_bold:
        return True
    return False


def cell_info(tc):
    paras = tc.findall('.//' + qn('w:p'))
    texts, marked = [], []
    runs_all = []
    for p in paras:
        para = docx.text.paragraph.Paragraph(p, None)
        runs_all.extend(para.runs)
        texts.append(para.text)
    # The template's own option words are plain; most runs not bold → "bold" counts as a mark
    bold_runs = sum(1 for r in runs_all if r.bold and r.text.strip())
    base_bold = bold_runs > len([r for r in runs_all if r.text.strip()]) / 2
    for r in runs_all:
        t = r.text.strip()
        if t and run_marked(r, base_bold):
            marked.append(t)
    text = '\n'.join(t for t in texts).strip()
    for m in TICKS.finditer(text):
        # the word right after (or before) a tick
        after = text[m.end():].strip().split()
        before = text[:m.start()].strip().split()
        if after:
            marked.append(after[0])
        elif before:
            marked.append(before[-1])
    return {'text': text, 'marked': marked}


def main(path):
    d = docx.Document(path)
    rows = []
    for tbl in d.element.body.iter(qn('w:tbl')):
        for tr in tbl.iter(qn('w:tr')):
            cells, seen = [], set()
            for tc in tr.findall(qn('w:tc')):
                key = id(tc)
                if key in seen:
                    continue
                seen.add(key)
                cells.append(cell_info(tc))
            rows.append(cells)
    paras = [p.text.strip() for p in d.paragraphs if p.text.strip()]
    print(json.dumps({'rows': rows, 'paragraphs': paras}, ensure_ascii=False))


if __name__ == '__main__':
    main(sys.argv[1])

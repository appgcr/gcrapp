"""
Fills a bank template with one case's data.

Usage:  python3 fill_report.py job.json
job.json = {
  "template": ".../templates/apgb_house.docx",
  "out": ".../report.docx",
  "fields": { "ownerName": "Sri M. Subba Naik", ... },      # {{ownerName}}
  "rows":   { "fl": [ { "label": "Ground Floor", ... }, ... ] }, # rows with {{fl.*}} repeat per item
  "images": { "photo1": "/path/a.jpg", "map1": "/path/map.png", ... }  # {{img:photo1:w:h}}
}
Empty values print as '---' (the bank's own style for "not applicable").
"""
import copy
import json
import os
import re
import sys
import tempfile

import docx
from docx.oxml.ns import qn
from docx.shared import Emu
from PIL import Image, ImageOps

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from docx_tools import unique_cells, textbox_paragraphs  # noqa: E402

TAG = re.compile(r'\{\{\s*([\w.]+)\s*\}\}')
IMG = re.compile(r'\{\{img:(\w+):(\d+):(\d+)\}\}')
BLANK = '---'
EMPTY = ' '  # a single space means: leave the cell empty


def value_of(fields, key):
    v = fields.get(key)
    if v == EMPTY:            # deliberately blank (e.g. upper-floor column on a single-floor house)
        return ''
    if v is None or (isinstance(v, str) and not v.strip()):
        return BLANK
    return str(v)


def set_run_text(run, text):
    """Set run text; '\n' becomes a line break inside the same paragraph."""
    parts = text.split('\n')
    run.text = parts[0]
    for part in parts[1:]:
        run.add_break()
        run._r.append(run._r.makeelement(qn('w:t'), {qn('xml:space'): 'preserve'}))
        run._r[-1].text = part


DROP = '__DROP__'  # a field with this value removes its whole line (e.g. no second owner / no applicant)
DROP_ROW = '__DROPROW__'  # …and this one removes the whole table row (e.g. an unused land-item block)


def _real(v):
    return bool(v) and v != DROP and v != DROP_ROW and v.strip(' ,.-') != ''


def show_all_people(doc, fields):
    """Every owner and the applicant entered on a case must appear in the report. Many bank layouts have a
    single owner block: extra owners (and an applicant, when the layout has no applicant section) are added
    as lines under the owner's address in that block."""
    from docx.oxml.ns import qn as _qn
    text = ''.join(t.text or '' for t in doc.element.body.iter(_qn('w:t')))
    present = set(TAG.findall(text))
    addr_key = next((k for k in ('owner1Addr', 'ownerAddress', 'owner1AddrLine') if k in present), None)
    if not addr_key:
        return
    extra = []
    has_second = any(re.match(r'(owner[2-5]|ownerLine[2-5]|ownerNum[2-5])', t) for t in present)
    if not has_second:
        for i in (2, 3, 4, 5):
            name, rel = fields.get(f'owner{i}Name'), fields.get(f'owner{i}Rel')
            if _real(name):
                name = name.strip().rstrip(',')
                extra.append(f'{name}, {rel.strip().rstrip(".")}.' if _real(rel) else f'{name}.')
    has_app = any(re.match(r'(applicant|customer)', t, re.I) for t in present)
    if not has_app and _real(fields.get('applicantName')):
        name, rel = fields['applicantName'].strip().rstrip(','), fields.get('applicantRel')
        extra.append('Applicant : ' + (f'{name}, {rel.strip().rstrip(".")}.' if _real(rel) else f'{name}.'))
        if _real(fields.get('applicantAddr')):
            extra.append(fields['applicantAddr'].strip())
    if extra:
        base = fields.get(addr_key)
        base = base if _real(base) else ''
        fields[addr_key] = '\n'.join([base] + extra) if base else '\n'.join(extra)


def drop_rows(container, fields):
    for t in container.tables:
        for row in list(t.rows):
            cells = unique_cells(row)
            txt = ''.join(c.text for c in cells)
            if any(fields.get(k) == DROP_ROW for k in TAG.findall(txt)):
                row._tr.getparent().remove(row._tr)
                continue
            for c in cells:
                drop_rows(c, fields)


def fill_text(paragraph, fields):
    keys = TAG.findall(paragraph.text)
    dropped = [k for k in keys if fields.get(k) == DROP]
    # The line goes only when nothing on it has a value (e.g. no 2nd owner). A filled name next to
    # an empty relation ("Sri X, {{rel}}.") keeps the name and loses only the empty part.
    if dropped and not any(_real(str(fields.get(k) or "")) for k in keys if k not in dropped):
        el = paragraph._p
        parent = el.getparent()
        siblings = [x for x in parent if x.tag == el.tag]
        if parent.tag.endswith('}tc') and len(siblings) <= 1:
            for run in paragraph.runs:
                run.text = ''          # a table cell must keep one paragraph
        else:
            parent.remove(el)
        return
    for run in paragraph.runs:
        if '{{' not in run.text or '{{img:' in run.text:
            continue
        new = TAG.sub(lambda m: '' if fields.get(m.group(1)) == DROP else value_of(fields, m.group(1)), run.text)
        set_run_text(run, new)
    if dropped:
        tidy_separators(paragraph)
    if 'fileNo' in keys:
        if '\t' in paragraph.text:
            pin_file_no_right(paragraph)
        else:
            extra = len(str(value_of(fields, 'fileNo'))) - len('GCR/KDP/2026/11/0001')
            if extra > 0:
                give_back_spaces(paragraph, extra)


def pin_file_no_right(paragraph):
    """'… Valuers F – 13622.<tab><tab><tab><tab> FILE NO – GOURU/KDP/2026/11/0001': the run of tabs
    becomes one right-aligned tab at the right margin, so the file number ends at the margin and never
    wraps onto a second line, whatever its length (GCR/… or GOURU/…)."""
    from docx.enum.text import WD_TAB_ALIGNMENT
    tab_runs = [r for r in paragraph.runs if r.text and set(r.text) == {'\t'}]
    if not tab_runs:
        return
    tab_runs[0].text = '\t'
    for r in tab_runs[1:]:
        r.text = ''
    try:
        sec = paragraph.part.package.main_document_part.document.sections[0]
        width = sec.page_width - sec.left_margin - sec.right_margin
        paragraph.paragraph_format.tab_stops.add_tab_stop(width, WD_TAB_ALIGNMENT.RIGHT)
    except Exception as e:  # never stop a report over a layout nicety
        print('fileNo tab stop skipped:', repr(e), file=sys.stderr)


def give_back_spaces(paragraph, count):
    """The templates leave room for a 20-character file number (GCR/KDP/2026/11/0001). A longer one
    (GOURU/KDP/2026/11/0001) takes that many spaces back from the padding on the same line, so the
    rest of the line (e.g. the date on the right) stays where the bank's format puts it."""
    for run in paragraph.runs:
        t = run.text
        while count > 0:
            m = re.search(r' {2,}', t)
            if not m:
                break
            take = min(count, len(m.group(0)) - 1)     # always keep one space between items
            t = t[:m.start()] + ' ' * (len(m.group(0)) - take) + '\x00' + t[m.end():]
            count -= take
        t = t.replace('\x00', '')
        if t != run.text:
            run.text = t
        if count <= 0:
            return


def drop_unused_images(doc):
    """The bank's sample photos that no longer appear anywhere are removed from the file, so another
    customer's pictures never travel inside this report (and the file stays small)."""
    parts = [doc.part] + [r.target_part for r in doc.part.rels.values()
                          if not r.is_external and r.reltype.endswith(('/header', '/footer'))]
    for part in parts:
        xml = part.blob if part is not doc.part else None
        used = set(re.findall(r'r:(?:embed|id|link)="([^"]+)"', (xml.decode('utf8') if xml else
                    part._element.xml)))
        for rid, rel in list(part.rels.items()):
            if rel.reltype.endswith('/image') and rid not in used:
                del part.rels[rid]


def tidy_separators(paragraph):
    """After an empty part is removed: 'Sri X, .' → 'Sri X.' and no trailing comma."""
    runs = [r for r in paragraph.runs if r.text]
    for i, r in enumerate(runs):
        t = re.sub(r',\s*\.', '.', r.text)
        nxt = next((x.text for x in runs[i + 1:] if x.text.strip()), '')
        if re.fullmatch(r'[\s,]*', t) and (not nxt or nxt.lstrip().startswith(('.', ','))):
            t = ''
        elif not nxt.strip() or nxt.lstrip().startswith(('.', ',')):
            t = re.sub(r'\s*,?\s*$', '', t)
        if t != r.text:
            r.text = t


def repeat_rows(doc, rows):
    """Rows containing {{prefix.*}} are copied once per item in rows[prefix].
    Several consecutive rows with the same prefix form one block (e.g. a land item's header +
    North/South/East/West rows) and are copied together."""
    from docx.table import _Row
    for table in doc.tables:
        groups, current = [], None
        for row in table.rows:
            txt = ''.join(c.text for c in unique_cells(row))
            m = re.search(r'\{\{\s*(\w+)\.', txt)
            prefix = m.group(1) if m and m.group(1) in rows else None
            if prefix and current and current[0] == prefix and current[1][-1]._tr.getnext() is row._tr:
                current[1].append(row)
            elif prefix:
                current = (prefix, [row])
                groups.append(current)
            else:
                current = None
        for prefix, block in groups:
            items = rows[prefix] or []
            anchor = block[-1]._tr
            for i, item in enumerate(items):
                local = {f'{prefix}.{k}': v for k, v in item.items()}
                local.setdefault(f'{prefix}.sno', str(i + 1))
                for src in block:
                    new = copy.deepcopy(src._tr)
                    anchor.addnext(new)
                    anchor = new
                    for c in unique_cells(_Row(new, table)):
                        for p in c.paragraphs:
                            fill_text(p, local)
            for src in block:
                src._tr.getparent().remove(src._tr)


def fit_image(path, w_emu, h_emu, contain=False):
    """Center-crop a photo to the slot's shape (no stretching) and return a temp JPEG path.
    contain=True (signatures): show the whole image on white instead of cropping."""
    im = ImageOps.exif_transpose(Image.open(path))
    if im.mode in ('RGBA', 'LA', 'P'):
        im = im.convert('RGBA')
        bg = Image.new('RGBA', im.size, (255, 255, 255, 255))
        im = Image.alpha_composite(bg, im)
    im = im.convert('RGB')
    target = w_emu / h_emu
    iw, ih = im.size
    if contain:
        bbox = ImageOps.invert(im.convert('L')).getbbox()   # trim empty margins around the ink
        if bbox:
            im = im.crop(bbox)
            iw, ih = im.size
        cw, ch = (iw, int(iw / target)) if iw / ih > target else (int(ih * target), ih)
        canvas = Image.new('RGB', (max(cw, 1), max(ch, 1)), (255, 255, 255))
        canvas.paste(im, ((cw - iw) // 2, (ch - ih) // 2))
        im = canvas
    elif iw / ih > target:
        nw = int(ih * target)
        im = im.crop(((iw - nw) // 2, 0, (iw - nw) // 2 + nw, ih))
    else:
        nh = int(iw / target)
        im = im.crop((0, (ih - nh) // 2, iw, (ih - nh) // 2 + nh))
    im.thumbnail((1800, 1800))
    fd, out = tempfile.mkstemp(suffix='.png' if contain else '.jpg')
    os.close(fd)
    im.save(out, 'PNG' if contain else 'JPEG', **({} if contain else {'quality': 86}))
    return out


def fill_images(doc, images, temps):
    for p in list(doc.paragraphs):
        if '{{img:' not in p.text:
            continue
        placed = False
        for run in p.runs:
            m = IMG.search(run.text)
            if not m:
                continue
            name, w, h = m.group(1), int(m.group(2)), int(m.group(3))
            run.text = ''
            src = images.get(name)
            if src and os.path.exists(src):
                try:
                    fitted = fit_image(src, w, h, contain=name.startswith('sig'))
                except Exception as err:  # one damaged photo must not stop the bank's report
                    print(f'Skipping unreadable image {name}: {err}', file=sys.stderr)
                    continue
                temps.append(fitted)
                run.add_picture(fitted, width=Emu(w), height=Emu(h))
                placed = True
        if not placed and not p.text.strip():
            p._element.getparent().remove(p._element)


CUT = re.compile(r'\{\{(end)?cut:(\w+)\}\}')


def apply_cuts(doc, drop):
    """Optional sections sit between {{cut:name}} and {{endcut:name}} paragraphs.
    Sections named in `drop` are removed with their content; otherwise only the markers go."""
    body = doc.element.body
    removing = None
    for el in list(body.iterchildren()):
        if el.tag == qn('w:sectPr'):
            continue
        txt = ''.join(t.text or '' for t in el.iter(qn('w:t')))
        m = CUT.search(txt)
        if m:
            name = m.group(2)
            if not m.group(1) and name in drop:
                removing = name
            elif m.group(1) and removing == name:
                removing = None
            body.remove(el)
            continue
        if removing:
            body.remove(el)


def main(job_path):
    with open(job_path, encoding='utf-8') as f:
        job = json.load(f)
    doc = docx.Document(job['template'])
    if job.get('branch'):
        from letterhead import apply_branch
        apply_branch(doc, job['branch'])   # branch letterhead / valuer, before any customer text goes in
    apply_cuts(doc, set(job.get('drop', [])))
    repeat_rows(doc, job.get('rows', {}))
    temps = []
    fill_images(doc, job.get('images', {}), temps)

    show_all_people(doc, job.get('fields', {}))
    drop_rows(doc, job.get('fields', {}))

    # Text everywhere (body, tables, headers, footers)
    def walk(container):
        for p in container.paragraphs:
            fill_text(p, job.get('fields', {}))
        for t in container.tables:
            for row in t.rows:
                for c in unique_cells(row):
                    walk(c)
    walk(doc)
    for p in textbox_paragraphs(doc):
        fill_text(p, job.get('fields', {}))
    for s in doc.sections:
        for part in (s.header, s.footer):
            walk(part)

    drop_unused_images(doc)
    doc.save(job['out'])
    for t in temps:
        try:
            os.unlink(t)
        except OSError:
            pass
    left = [m for p in doc.paragraphs for m in TAG.findall(p.text)]
    print(json.dumps({'ok': True, 'out': job['out'], 'unfilled': left[:10]}))


if __name__ == '__main__':
    main(sys.argv[1])

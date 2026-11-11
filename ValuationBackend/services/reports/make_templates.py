"""
Builds fill-in templates from the bank's own sample reports.

Run:  python3 make_templates.py
In:   apgb_source/<format>.docx   (the bank's sample report, exactly as supplied)
Out:  templates/apgb_<format>.docx (same file, sample values replaced by {{tags}})

Only the sample values are swapped for tags — the letterhead, tables, fonts, borders,
spacing and fixed wording stay byte-for-byte the bank's design.
"""
import os
import sys
import docx
from docx.oxml.ns import qn
from docx_tools import replace_span, set_cell, find_para, set_para_text, para_text

HERE = os.path.dirname(os.path.abspath(__file__))


def T(name):
    return '{{' + name + '}}'


def span(doc, locator, old, tag, nth=1, occurrence=1):
    p = find_para(doc, locator, nth)
    if not replace_span(p, old, T(tag), occurrence):
        raise ValueError(f'{old!r} not found in paragraph {locator!r}: {para_text(p)[:120]!r}')


def whole(doc, locator, text, nth=1):
    set_para_text(find_para(doc, locator, nth), text)


def _trim_spaces(p, n):
    """Remove n spaces from the longest whitespace run (keeps right-aligned text on one line)."""
    runs = [r for r in p.runs if r.text and not r.text.strip()]
    if runs:
        longest = max(runs, key=lambda r: len(r.text))
        longest.text = longest.text[:max(1, len(longest.text) - n)]


def _drop_tabs(p, n):
    """Remove n tab characters and the loose spaces before a right-hand value (room for long file numbers)."""
    for r in p.runs:
        if n and r.text and not r.text.strip() and '\t' in r.text:
            k = min(n, r.text.count('\t'))
            r.text = r.text.replace('\t', '', k)
            n -= k
    for r in p.runs:
        if r.text and not r.text.strip() and '\t' not in r.text and len(r.text) > 1:
            r.text = ' '


def cspan(table, r, c, pairs, para=0):
    """Replace values inside a cell paragraph, keeping each piece's colour/bold."""
    p = table.rows[r].cells[c].paragraphs[para]
    for old, tag in pairs:
        if not replace_span(p, old, T(tag)):
            raise ValueError(f'{old!r} not in cell T r{r} c{c}: {p.text[:80]!r}')


def cell(table, r, c, *tags):
    set_cell(table.rows[r].cells[c], *[T(t) if t and not t.startswith('=') else (t[1:] if t else '') for t in tags])


def set_cell_para(table, r, c, i, text):
    set_para_text(table.rows[r].cells[c].paragraphs[i], text)


def mark_region(doc, start_text, end_text, marker):
    """Delete everything between two headings and leave one paragraph with `marker`
    (used for the hand-drawn location sketch, which is replaced by a generated map)."""
    body = doc.element.body
    kids = list(body.iterchildren())
    def text_of(el):
        return ''.join(t.text or '' for t in el.iter(qn('w:t')))
    si = next(i for i, el in enumerate(kids) if el.tag == qn('w:p') and start_text in text_of(el))
    ei = next(i for i, el in enumerate(kids) if i > si and el.tag == qn('w:p') and end_text in text_of(el))
    for el in kids[si + 1:ei]:
        body.remove(el)
    # new centered paragraph holding the marker
    from copy import deepcopy
    p = deepcopy(kids[si])
    for r in p.findall(qn('w:r')):
        p.remove(r)
    kids[si].addnext(p)
    from docx.text.paragraph import Paragraph
    para = Paragraph(p, doc._body)
    para.add_run(marker)


def mark_images(doc, after_text, marker_prefix, stop_text=None):
    """Replace each picture after a heading with a numbered slot marker (filled with case photos)."""
    body = doc.element.body
    kids = list(body.iterchildren())
    def text_of(el):
        return ''.join(t.text or '' for t in el.iter(qn('w:t')))
    si = next(i for i, el in enumerate(kids) if el.tag == qn('w:p') and after_text in text_of(el))
    n = 0
    for el in kids[si + 1:]:
        if el.tag != qn('w:p'):
            continue
        if stop_text and stop_text in text_of(el):
            break
        for r in el.findall(qn('w:r')):
            drawing = r.find(qn('w:drawing'))
            if drawing is None:
                continue
            ext = drawing.find('.//' + qn('wp:extent'))
            w, h = int(ext.get('cx')), int(ext.get('cy'))
            n += 1
            for child in list(r):
                if child.tag != qn('w:rPr'):
                    r.remove(child)
            t = r.makeelement(qn('w:t'), {})
            t.text = '{{img:%s%d:%d:%d}}' % (marker_prefix, n, w, h)
            r.append(t)
        if marker_prefix == 'map' and n:
            break
    return n


def span_re(doc, locator, pattern, tag, nth=1, group=0):
    """Like span(), but the sample text is found with a regex (for values split by odd spacing)."""
    import re
    p = find_para(doc, locator, nth)
    m = re.search(pattern, para_text(p))
    if not m:
        raise ValueError(f'{pattern!r} not found in paragraph {locator!r}: {para_text(p)[:120]!r}')
    if not replace_span(p, m.group(group), T(tag) if not tag.startswith('=') else tag[1:]):
        raise ValueError(pattern)


def p_span_re(p, pattern, tag, group=0):
    import re
    m = re.search(pattern, para_text(p))
    if not m:
        raise ValueError(f'{pattern!r} not in {para_text(p)[:100]!r}')
    replace_span(p, m.group(group), T(tag))


def insert_marker_after(p, marker):
    """New empty-styled paragraph after p holding a section marker (e.g. {{cut:additions}})."""
    from copy import deepcopy
    from docx.text.paragraph import Paragraph
    el = deepcopy(p._p)
    for r in el.findall(qn('w:r')):
        el.remove(r)
    p._p.addnext(el)
    para = Paragraph(el, p._parent)
    para.add_run(marker)
    return para


def append_marker(doc, marker):
    body = doc.element.body
    from docx.text.paragraph import Paragraph
    p = body.makeelement(qn('w:p'), {})
    body.find(qn('w:sectPr')).addprevious(p)
    Paragraph(p, doc._body).add_run(marker)


def pct_tags(doc, realizable, distress):
    """'(90 % of the Fair Market Value …)' → the bank's own % from Settings → Banks."""
    from docx_tools import all_paragraphs
    for p in all_paragraphs(doc):
        tx = para_text(p)
        if '% of the Fair Market' not in tx:
            continue
        old, tag = (distress, 'distressPct') if 'Distress' in tx else (realizable, 'realizablePct')
        replace_span(p, old + ' %', T(tag) + ' %')


SIGNATURE = '{{img:signature:1371600:548640}}'


def mark_signatures(doc):
    """A slot for the engineer's digital signature just above each valuer 'Signature' line
    (not the Branch Manager's). With no signature on the case the slot disappears."""
    from copy import deepcopy
    from docx.text.paragraph import Paragraph
    paras = list(doc.paragraphs)
    for i, p in enumerate(paras):
        tx = para_text(p)
        if 'Signature' not in tx:
            continue
        nxt = next((para_text(x) for x in paras[i + 1:i + 5] if para_text(x).strip()), '')
        if 'Signature of the Valuer' not in tx and 'approved valuer' not in nxt.lower():
            continue
        clone = deepcopy(p._p)
        # Big left/right indents (narrow signature column) would squeeze the picture — drop them
        ppr = clone.find(qn('w:pPr'))
        ind = ppr.find(qn('w:ind')) if ppr is not None else None
        if ind is not None:
            ppr.remove(ind)
        p._p.addprevious(clone)
        para = Paragraph(clone, p._parent)
        replace_span(para, 'Signature of the Valuer' if 'Signature of the Valuer' in tx else 'Signature', SIGNATURE)
        for r in para.runs:
            if r.text.strip() and '{{img:' not in r.text:
                r.text = ' ' * len(r.text)       # keep the same position on the line


# --------------------------------------------------------------------------- HOUSE
def house(doc):
    t = doc.tables
    # Front page
    span(doc, 'FILE NO', '2605115', 'fileNo')
    # GCR file numbers (GCR/KDP/2026/11/0001) are 13 characters longer than the sample's — give back that space
    span(doc, 'FILE NO', ' ' * 13, '=') if False else _trim_spaces(find_para(doc, 'FILE NO'), 13)
    span(doc, 'District :', 'Y.S.R', 'district')
    span(doc, 'Branch :', 'POLICE LANE BRANCH, KADAPA', 'bankBranchUpper')
    span(doc, 'Date  :  25-05-2026', '25-05-2026', 'reportDate')
    span(doc, 'Subba Naik', 'Sri M. Subba Naik', 'ownerName')        # big blue italic
    span(doc, 'Jamla Naik', 'S/o Sri M. Jamla Naik (late)', 'ownerRelation')  # smaller bold
    whole(doc, 'Door No : 44/37-4-15, Co-Operative', T('ownerAddress'))
    span(doc, 'Deed No       :', '4004/2016', 'deedNo')
    span(doc, 'Deed No       :', '2.83 Cents', 'netExtentShort')
    span(doc, 'Door No        :', '44/37-4-15', 'doorNo')
    span(doc, 'Door No        :', '343', 'surveyNo')
    span(doc, 'Plot No          :', '22(part) & 23 (part)', 'plotNo')
    span(doc, 'Plan Approved', '1013/0114/B/KAD/CMPT/2021', 'planNo')
    span(doc, 'Plan Approved', '12-02-2021', 'planDate')
    # Keep each coloured / bold piece of the title paragraph in its own style
    L = 'Valuation Report of Residential'
    span(doc, L, 'GF', 'floorsLine')
    span(doc, L, '343', 'surveyNo')
    span(doc, L, '44/37-4-15', 'doorNo')
    span(doc, L, '22(part) & 23 (part)', 'plotNo')
    span(doc, L, '44', 'wardNo')
    span(doc, L, 'In Western side of Rayachoty Road, Near Turning Point Coaching Center', 'landmark')
    span(doc, L, 'Chemmumiahpeta Village Field', 'village')
    span(doc, L, 'Kadapa Municipal Corporation of Y.S.R (DT).', 'localBody')
    span(doc, 'Valuation:  Rs', '87,14,000', 'fmv')
    whole(doc, '(RUPEES EIGHTY', '(' + T('fmvWordsUpper') + ')')
    whole(doc, 'KADAPA MUNICIPAL CORPORATION Y.S.R (DT).', T('localBodyUpper'))

    # I. General (table 0)
    a = t[0]
    cell(a, 1, 6, 'purpose')
    cell(a, 2, 6, 'inspectionDate')
    cell(a, 3, 6, 'valuationDate')
    cell(a, 5, 6, 'saleDeedLine')
    PLAN = [('1013/0114/B/KAD/CMPT/2021', 'planNo'), ('12-02-2021', 'planDate')]
    cspan(a, 6, 6, PLAN)
    cell(a, 7, 6, 'mvCertificate')
    cspan(a, 8, 6, [('Sri M. Subba Naik', 'ownerName')], para=1)
    cspan(a, 8, 6, [('S/o Sri M. Jamla Naik (late)', 'ownerRelation')], para=2)
    set_cell_para(a, 8, 6, 3, T('ownerAddress'))
    cell(a, 9, 6, 'tenure')
    cspan(a, 11, 6, [('343', 'surveyNo')])
    cspan(a, 12, 6, [('44/37-4-15', 'doorNo')])
    cell(a, 13, 6, 'village')
    cspan(a, 14, 6, [('44', 'wardNo'), ('In Western side of Rayachoty Road, Near Turning Point Coaching Center', 'landmark')])
    cell(a, 15, 6, 'mandalDistrict')
    cspan(a, 16, 6, [('343', 'surveyNo'), ('44/37-4-15', 'doorNo'), ('22(part) & 23 (part)', 'plotNo'), ('44', 'wardNo'),
                     ('In Western side of Rayachoty Road, Near Turning Point Coaching Center', 'landmark'),
                     ('Chemmumiahpeta Village Field', 'village'), ('Kadapa Municipal Corporation of Y.S.R (DT).', 'localBody')])
    cell(a, 17, 6, 'cityTown')
    cell(a, 18, 6, 'areaResidential')
    cell(a, 19, 6, 'areaCommercial')
    cell(a, 20, 6, 'areaIndustrial')
    cell(a, 22, 6, 'areaClass')
    cell(a, 23, 6, 'areaUrban')

    b = t[1]
    cell(b, 0, 5, 'localBodyType')
    cell(b, 1, 5, 'govtEnactments')
    cell(b, 2, 5, 'agriConversion')
    for r, side in ((5, 'East'), (6, 'West'), (7, 'North'), (8, 'South')):
        cell(b, r, 3, f'bdDeed{side}')
        cell(b, r, 5, f'bdActual{side}')
    for r, side in ((11, 'East'), (12, 'West'), (13, 'North'), (14, 'South')):
        cell(b, r, 3, f'dimDeed{side}')
        cell(b, r, 5, f'dimActual{side}')
    cell(b, 15, 3, 'extentDeed')
    cell(b, 15, 5, 'extentActual')
    cell(b, 16, 5, 'netExtentPlan')
    cell(b, 17, 6, 'gpsDecimal')   # one merged cell for both Latitude and Longitude rows
    cell(b, 19, 5, 'extentSite')
    cell(b, 20, 5, 'extentConsidered')
    cell(b, 21, 5, 'occupancy')
    chars = ['locality', 'surroundings', 'flooding', 'civicAmenities', 'levelOfLand', 'landShape',
             'landUse', 'usageRestriction', 'layoutApproved', 'cornerPlot', 'roadFacilities',
             'roadType', 'roadWidth', 'landLocked', 'water', 'sewerage', 'power']
    for i, key in enumerate(chars):
        cell(b, 23 + i, 5, key)
    cell(b, 41, 5, 'advantage1')
    cell(b, 42, 5, 'advantage2')
    cell(b, 43, 5, 'specialRemarks')
    cell(b, 45, 5, 'plotShape')
    cell(b, 46, 5, 'sizeNorthSouth')
    cell(b, 47, 5, 'sizeEastWest')
    cell(b, 48, 5, 'totalExtent')
    cell(b, 49, 5, 'netExtentPlan')
    cell(b, 50, 5, 'marketRateLine')
    cell(b, 51, 5, 'guidelineRateLine')
    cell(b, 52, 5, 'adoptedRateLine')
    cell(b, 53, 5, 'landValueLine')

    # Part B building (table 2)
    c = t[2]
    cell(c, 2, 6, 'buildingType')
    cell(c, 3, 6, 'constructionType')
    cell(c, 4, 6, 'yearOfConstruction')
    cell(c, 5, 6, 'ageLine')
    cell(c, 6, 6, 'remainingLifeLine')
    cell(c, 7, 6, 'totalLifeLine')
    cell(c, 8, 6, 'floorsLine')
    cell(c, 12, 3, 'plinthPlan')
    cell(c, 12, 6, 'plinthActual')
    cell(c, 15, 3, 'carpetPlan')
    cell(c, 15, 6, 'carpetActual')
    cell(c, 17, 6, 'conditionExterior')
    cell(c, 18, 6, 'conditionInterior')
    cspan(c, 19, 6, PLAN)
    cell(c, 20, 6, 'planAuthority')
    cell(c, 21, 6, 'planVerified')
    cell(c, 22, 6, 'planComments')

    # Specifications (table 3): ground floor column and upper floors column
    d = t[3]
    specs = ['foundation', 'basement', 'superstructure', 'joinery', 'rccWorks', 'plastering',
             'flooring', 'specialFinish', 'roofing', 'drainage']
    for i, key in enumerate(specs):
        cell(d, 1 + i, 4, f'specGF_{key}')
        cell(d, 1 + i, 6, f'specUpper_{key}')
    for r, key in ((12, 'compoundWall'), (13, 'cwHeight'), (14, 'cwLength'), (15, 'cwType'),
                   (17, 'wiring'), (18, 'fittingsClass'), (19, 'lightPoints'), (20, 'plugPoints'),
                   (21, 'electricalOther'), (23, 'waterClosets'), (24, 'washBasins'), (25, 'urinals'),
                   (26, 'bathTubs'), (27, 'waterMeter'), (28, 'otherFixtures')):
        cell(d, r, 5, key)

    # Details of valuation (table 4): one template row repeated per floor
    e = t[4]
    row = e.rows[1]
    for ci, key in ((0, 'fl.sno'), (1, 'fl.label'), (2, 'fl.plinth'), (3, 'fl.height'), (4, 'fl.age'),
                    (5, 'fl.rate'), (6, 'fl.replacement'), (7, 'fl.depreciation'), (8, 'fl.net')):
        set_cell(row.cells[ci], T(key))
    e._tbl.remove(e.rows[2]._tr)
    set_cell(e.rows[2].cells[8], T('buildingTotalLine'))

    # Parts C–F
    for ti, keys in ((5, ['ex_portico', 'ex_frontDoor', 'ex_sitOut', 'ex_ohTank', 'ex_gates', 'partC']),
                     (6, ['am_wardrobes', 'am_glazedTiles', 'am_sinks', 'am_marble', 'am_interior', 'am_elevation',
                          'am_paneling', 'am_aluminium', 'am_handRails', 'am_falseCeiling', 'am_parking', 'partD']),
                     (7, ['mi_toilet', 'mi_lumber', 'mi_sump', 'mi_trees', 'partE']),
                     (8, ['sv_water', 'sv_drainage', 'sv_compoundWall', 'sv_cbDeposits', 'sv_pavement', 'sv_lift', 'partF'])):
        for r, key in enumerate(keys):
            cell(t[ti], r, 3, key)

    # Abstract + values
    for r, key in enumerate(['absA', 'absB', 'absC', 'absD', 'absE', 'absF', 'absTotal', 'absSayAs']):
        cell(t[9], r, 3, key)
    cell(t[10], 0, 1, 'fmvLine')
    cell(t[10], 1, 1, 'realizableLine')
    cell(t[10], 2, 1, 'distressLine')

    # Closing paragraphs
    whole(doc, 'Rs 87,14,000/- (Rupees', 'Rs ' + T('fmv') + '/- (' + T('fmvWords') + '),')
    span(doc, 'Book Value of the', '5,77,000', 'bookValue')
    span(doc, 'Net Realizable Value of the Above', '78,42,000', 'realizable')
    span(doc, 'Net Realizable Value of the Above', 'Rupees Seventy Eight Lakhs Forty Two Thousand Only', 'realizableWords')
    whole(doc, 'Rs 69,71,000/- (Rupees', 'Rs ' + T('distress') + '/- (' + T('distressWords') + ').')
    span(doc, 'Place  : Kadapa', 'Kadapa', 'place')
    span(doc, 'Date   :  25-05-2026', '25-05-2026', 'reportDate')
    span(doc, 'report  dated', '25-05-2026', 'reportDate')
    span(doc, 'inspected  the  property', '23-05-2026', 'inspectionDate')

    # Declaration table (table 11)
    g = t[11]
    cell(g, 1, 2, 'declBackground')
    cell(g, 2, 2, 'declPurpose')
    cell(g, 5, 2, 'declDates1', 'declDates2', 'declDates3')
    span(doc, 'Date  :  25-05-2026', '25-05-2026', 'reportDate')
    span(doc, 'Place :   Kadapa', 'Kadapa', 'place')
    span(doc, 'Place :  Kadapa', 'Kadapa', 'place')
    span(doc, 'Date  : 25-05-2026', '25-05-2026', 'reportDate')

    # Maps and photos
    whole(doc, '14°26', T('gpsDms'))
    whole(doc, '14.448828, 78.806303', T('gpsDecimal'))
    mark_region(doc, 'LOCATION – MAP', 'PHOTO’S', '{{img:areaMap:5943600:4114800}}')
    mark_images(doc, 'PHOTO’S', 'photo', stop_text='GOOGLE')
    mark_images(doc, 'GOOGLE – MAP', 'map')
    pct_tags(doc, '90', '80')


def replace_all_body(doc, old, tag):
    """Every body paragraph containing `old` gets it replaced (each occurrence)."""
    for p in doc.paragraphs:
        while old in para_text(p):
            replace_span(p, old, T(tag))


# --------------------------------------------------------------------------- APARTMENT
def apartment(doc):
    t = doc.tables
    P = doc.paragraphs
    span(doc, 'FILE NO', '2603117', 'fileNo')
    _trim_spaces(find_para(doc, 'FILE NO'), 13)
    span(doc, 'District    :', 'Y S R', 'district')
    span(doc, 'POLICE LANE', 'POLICE LANE  BRANCH, KADAPA', 'bankBranchUpper')
    whole(doc, '“Sri Satya Sai Appartment”', '“' + T('aptName') + '”')
    whole(doc, 'Stilt, Ground Floor + 4 Upper Floors', T('floorsDesc'))
    span(doc, 'Builder', 'M/S KHAN INFRA TECH', 'builderName')
    span(doc, 'MANAGING PARTNER', 'Sri  P.Inthyaj Khan', 'partnerName')
    span(doc, 'MANAGING PARTNER', 'S/o Sri P.SATHAR KHAN.', 'partnerRelation')
    span(doc, 'Ravindra Reddy, S/o', 'Sri P . Ravindra Reddy', 'ownerName')
    span(doc, 'Rami Reddy.', 'S/o Sri P. Rami Reddy', 'ownerRelation')
    whole(doc, 'Middela Narasapuram, Kadapa Town', T('ownerAddress'))
    L = 'As Per Agreement'
    span(doc, L, 'G.P.A. Deed No', 'deedLabel')
    span(doc, L, '259/2022', 'deedNo')
    span(doc, L, '0.91', 'udsDeed')
    span(doc, L, '9.18', 'parentExtentDeed')
    L = 'Actual Net'
    span(doc, L, '347/2 & 350/4', 'surveyNo')
    span(doc, L, '0.82', 'udsPlan')
    span(doc, L, '8.29', 'parentExtentPlan')
    L = 'Flat No                  :'
    span(doc, L, '44/34-3-17', 'doorNo')
    span(doc, L, '402', 'flatNo')
    span(doc, L, 'Fourth', 'floorName')
    span(doc, 'PLAN', 'B.A.NO : 1013/0240/B/KAD/CMPT/2022   Dt : 10-03-2022', 'planLine')
    for L in ('Valuation Report of', 'ESTIMATION FOR THE PROPOSED'):
        span(doc, L, 'Semi Finished', 'buildingStatus')
        span(doc, L, 'Sri Satya Sai Apartment ', 'aptName')
        span(doc, L, '402', 'flatNo')
        span(doc, L, 'Fourth', 'floorName')
        span(doc, L, '44/34-3-17', 'doorNo')
        span(doc, L, '347/2 & 350/4', 'surveyNo')
        span(doc, L, 'Prakruthi Nagar', 'landmark')
        span(doc, L, 'Chemmumiahpeta', 'village')
        span(doc, L, 'Kadapa Municipal Corporation of  Y.S.R (Dt).', 'localBody')
    span(doc, 'Valuation:', '53,04,000', 'fmv')
    span_re(doc, '(RUPEES', r'\(RUPEES.*ONLY\)', '=(' + T('fmvWordsUpper') + ')')
    span_re(doc, 'KADAPA MUNICIPAL CORPORATION', r'KADAPA MUNICIPAL CORPORATION.*\.', 'localBodyUpper')

    # I. General
    a = t[0]
    cell(a, 1, 6, 'purpose')
    cell(a, 2, 6, 'inspectionDate')
    cell(a, 3, 6, 'valuationDate')
    cell(a, 5, 6, 'saleDeedLine')
    cspan(a, 6, 6, [('B.A.NO : 1013/0240/B/KAD/CMPT/2022   Dt : 10-03-2022', 'planLine')])
    cell(a, 7, 6, 'mvCertificate')
    set_cell_para(a, 8, 6, 0, T('ownerRole'))
    set_cell_para(a, 8, 6, 1, T('ownerName') + ', ')
    set_cell_para(a, 8, 6, 2, T('ownerRelation') + '.')
    set_cell_para(a, 8, 6, 3, T('ownerAddress'))
    cell(a, 9, 6, 'tenure')
    cspan(a, 11, 6, [('347/2 & 350/4', 'surveyNo')])
    cspan(a, 12, 6, [('44/34-3-17', 'doorNo')])
    cspan(a, 13, 6, [('Chemmumiahpeta', 'village')])
    cspan(a, 14, 6, [('44', 'wardNo'), ('Prakruthi Nagar', 'landmark')])
    cspan(a, 15, 6, [('Kadapa Municipal Corporation', 'localBodyName')], para=0)
    cspan(a, 15, 6, [('Y.S.R', 'district')], para=1)
    cell(a, 16, 6, 'postalAddress')
    cell(a, 17, 6, 'cityTown')
    cell(a, 18, 6, 'areaResidential')
    cell(a, 19, 6, 'areaCommercial')
    cell(a, 20, 6, 'areaIndustrial')
    cell(a, 22, 6, 'areaClass')
    cell(a, 23, 6, 'areaUrban')
    cell(a, 24, 6, 'localBodyType')

    b = t[1]
    cell(b, 0, 4, 'govtEnactments')
    cell(b, 1, 4, 'agriConversion')
    for r, side in ((4, 'East'), (5, 'West'), (6, 'North'), (7, 'South')):
        cell(b, r, 2, f'bdDeed{side}')
        cell(b, r, 4, f'bdActual{side}')
    for r, side in ((10, 'East'), (11, 'West'), (12, 'North'), (13, 'South')):
        cell(b, r, 2, f'dimDeed{side}')
        cell(b, r, 4, f'dimActual{side}')
    cell(b, 14, 2, 'extentDeed')
    cell(b, 14, 4, 'extentActual')
    cell(b, 15, 1, '=As Per Deed Total Extent : ' + T('extentDeed'))
    cell(b, 16, 5, 'gpsDecimal')
    cell(b, 18, 4, 'extentSite')
    cell(b, 19, 4, 'extentConsidered')
    cell(b, 20, 4, 'occupancy')

    # II. Apartment building / III. Flat / IV. Marketability / V. Rate
    c = t[2]
    for r, key in ((1, 'aptNature'), (2, 'flatLocationLine'), (3, 'surveyLine'), (5, 'wardVillageLine'),
                   (6, 'localBodyName'), (7, 'postalAddress'), (8, 'localityType'), (9, 'yearOfConstruction'),
                   (10, 'floorsShort'), (11, 'structure'), (12, 'unitsLine'), (13, 'quality'), (14, 'appearance'),
                   (15, 'maintenance'), (16, 'facilities'), (17, 'lift'), (18, 'protectedWater'), (19, 'sewerage'),
                   (20, 'carParkingType'), (21, 'compoundWall'), (22, 'pavement'), (24, 'floorLine'),
                   (25, 'flatNoLine'), (27, 'fbNorth'), (28, 'fbSouth'), (29, 'fbEast'), (30, 'fbWest'),
                   (37, 'specRoof'), (38, 'specFlooring'), (39, 'specDoors'), (40, 'specWindows'),
                   (41, 'specFittings'), (42, 'specFinishing'), (43, 'houseTax'), (44, 'assessmentNo'),
                   (45, 'taxPaidName'), (46, 'taxAmountLine'), (47, 'electricityNo'), (48, 'meterName'),
                   (49, 'flatMaintenance'), (51, 'udsLine'), (52, 'plinthLine'), (54, 'carpetLine'),
                   (55, 'flatClass'), (56, 'usage'), (57, 'occupancy'), (58, 'monthlyRent'),
                   (60, 'marketability'), (61, 'advantages'), (62, 'negatives')):
        cell(c, r, 4, key)
    cell(c, 4, 4, '=“' + T('aptName') + '”')
    cell(c, 31, 4, '=As Per Deed')
    cell(c, 32, 4, '', 'udsDeedDims')
    cell(c, 32, 7, '', 'udsPlanDims')
    cell(c, 50, 4, 'deedExecutant', 'deedExecutantRelation')
    cell(c, 64, 6, 'comparableRate')
    cell(c, 67, 6, 'buildingCalc1', 'buildingCalc2')
    cell(c, 68, 6, 'landCalc1', 'landCalc2')
    cell(c, 69, 6, 'guidelineNote')

    # VI. Composite rate after depreciation
    d = t[3]
    for r, key in ((1, 'deprRate'), (2, 'replacementLine'), (3, 'ageLine'), (4, 'remainingLifeLine'),
                   (5, 'totalLifeLine'), (6, 'deprValueLine'), (7, 'deprRatio'), (9, 'deprBuildingLine'),
                   (10, 'landValueLine'), (11, 'compositeLine')):
        cell(d, r, 3, key)

    # Details of valuation
    e = t[4]
    cell(e, 1, 2, '=' + T('plinth') + '/- Sqft')
    cell(e, 1, 4, 'compositeLine')
    for r, key in ((2, 'x_carParking'), (3, 'x_wardrobes'), (4, 'x_showcases'), (5, 'x_kitchen'),
                   (6, 'x_superfine'), (7, 'x_interior'), (8, 'x_electrical'), (9, 'x_grills'),
                   (10, 'x_potential'), (11, 'x_others')):
        cell(e, r, 4, key)
    cell(e, 12, 4, 'grandTotalLine', 'sayLine')

    # Valuer's comments
    g = t[5]
    cell(g, 1, 2, 'declBackground')
    cell(g, 2, 2, 'declPurpose')
    cell(g, 5, 2, 'declDates1', 'declDates2', 'declDates3')

    # Closing values
    span(doc, 'considered opinion', '53,04,000', 'fmv')
    span_re(doc, 'considered opinion', r'\(Rupees.*only\)\.', '=(' + T('fmvWords') + ').')
    span(doc, 'Realizable value of the above', '45,08,000', 'realizable')
    span_re(doc, 'Realizable value of the above', r'\(Rupees.*only\)\.', '=(' + T('realizableWords') + ').')
    span(doc, 'The distressed value', '39,78,000', 'distress')
    span_re(doc, 'The distressed value', r'\(Rupees.*only\)\.', '=(' + T('distressWords') + ').')

    # Maps and photos
    whole(doc, '14°27', T('gpsDms'))
    gps = find_para(doc, '14.455887, 78.809609')
    whole(doc, '14.455887, 78.809609', T('gpsDecimal'))
    mark_region(doc, 'LOCATION - MAP', 'Photo’s', '{{img:areaMap:5943600:4114800}}')
    mark_images(doc, 'Photo’s', 'photo', stop_text='Google')
    mark_images(doc, 'Google - Map’s', 'map')

    # Additions work estimate (separate page — removed when the case has no proposed additions)
    span(doc, 'FILE NO -', '2603117', 'fileNo')
    _trim_spaces(find_para(doc, 'FILE NO -'), 13)
    span(doc, 'Rami Reddy.', 'Sri P . Ravindra Reddy', 'ownerName', nth=1)
    span(doc, 'Rami Reddy.', 'S/o Sri P. Rami Reddy', 'ownerRelation', nth=1)
    items = [('SHOW CASE', 'qra'), ('WARD ROBES', 'qra'), ('KICTHEN RACKS', 'qa'), ('KITCHEN', 'qa'),
             ('POP (FALSE CEILING)', 'qa'), ('SAFETY GRILL', 'la'), ('BATH ROOM WALL', 'qRa'),
             ('SANITARY ARRANGEMENTS', 'Ra'), ('PAINT WORK', 'Ra')]
    body = list(doc.paragraphs)
    for i, (label, cols) in enumerate(items, 1):
        hp = next(k for k, p in enumerate(body) if label in para_text(p) and 'PROPOSED' in para_text(p))
        p = next(x for x in body[hp + 1:] if para_text(x).strip())
        if 'q' in cols:
            p_span_re(p, r'^\s*(\d+)', f'ad{i}_qty', group=1)
        if 'l' in cols:
            p_span_re(p, r'(L\.S)', f'ad{i}_qty', group=1)
        if 'r' in cols:
            p_span_re(p, r'(\d[\d,]*\.\d\d)', f'ad{i}_rate', group=1)
        if 'R' in cols:
            p_span_re(p, r'Rs\s*(\d[\d,]*)/-', f'ad{i}_rate', group=1)
        p_span_re(p, r'Rs\s*(\d[\d,]*\.\d\d)', f'ad{i}_amt', group=1)
    span(doc, 'TOTAL    =', '19,75,000', 'adTotal')
    span(doc, 'Say       Rs', '19,75,000', 'adTotal')
    span_re(doc, 'NINETEEN', r'\( RUPEES.*ONLY\)', '=( ' + T('adWordsUpper') + ')')
    span(doc, 'PLACE :', 'KADAPA', 'placeUpper')

    # Dates and places everywhere in the body
    replace_all_body(doc, '25-03-2026', 'reportDate')
    replace_all_body(doc, '24-03-2026', 'inspectionDate')
    for p in doc.paragraphs:
        tx = para_text(p)
        if 'Place' in tx and 'Kadapa' in tx:
            replace_span(p, 'Kadapa', T('place'))

    insert_marker_after(find_para(doc, T('gpsDecimal')), '{{cut:additions}}')
    append_marker(doc, '{{endcut:additions}}')


# --------------------------------------------------------------------------- OPEN SITE
def open_site(doc):
    t = doc.tables
    span(doc, 'FILE NO', '2512138', 'fileNo')
    _drop_tabs(find_para(doc, 'FILE NO'), 2)
    span(doc, 'District    :', 'Y S R', 'district')
    span(doc, 'Branch:', 'JAYA NAGAR COLONY BRANCH, KADAPA', 'bankBranchUpper')
    span(doc, 'Sirabhanu', 'Smt  Shaik. Sirabhanu', 'ownerName')
    span(doc, 'Mahaboob', 'W/o. Sri. Mahaboob Basha', 'ownerRelation')
    span_re(doc, 'Kagithala', r'Door No : .*\(Dt\)\.', 'ownerAddress')
    span(doc, 'Net Extent', '4968/2025', 'deedNo')
    span(doc, 'Net Extent', '2.01', 'consideredCents')
    span(doc, 'Survey No   :', '57/257-9-2-18', 'doorNo')
    span(doc, 'Survey No   :', '492/2B', 'surveyNo')
    span(doc, 'Plan Approved Under', 'BPS2025/KDP/KDP/48/025614', 'planNo')
    span(doc, 'Plan Approved Under', '16-02-2026', 'planDate')
    L = 'Valuation Report of'
    span(doc, L, 'Residential Vacant Site', 'siteType')
    span(doc, L, '492/2B', 'surveyNo')
    span(doc, L, '57/257-9-2-18', 'doorNo')
    span(doc, L, '57', 'wardNo')
    span(doc, L, 'Plot No : 14 (North Side)', 'plotLine')
    span(doc, L, 'Akkayapalli', 'landmark')
    span(doc, L, 'Chemmumaiahpeta', 'village')
    span(doc, L, 'Kadapa Municipal Corporation Of Y.S.R. (Dt).', 'localBody')
    span(doc, 'Valuation :', '14,07,000', 'fmv')
    span_re(doc, '(RUPEES', r'\(RUPEES.*ONLY\)', '=(' + T('fmvWordsUpper') + ')')
    span_re(doc, 'Kadapa Municipal Corporation, Y.S.R', r'Kadapa.*', 'localBodyLine')

    a = t[0]
    cell(a, 1, 5, 'purpose')
    cell(a, 2, 5, 'inspectionDate')
    cell(a, 3, 5, 'valuationDate')
    cell(a, 5, 5, 'saleDeedLine')
    cell(a, 6, 5, 'planLine')
    cell(a, 7, 5, 'mvCertificate')
    set_cell_para(a, 8, 5, 1, T('ownerName') + ',  ')
    set_cell_para(a, 8, 5, 2, T('ownerRelation') + '.')
    set_cell_para(a, 8, 5, 3, T('ownerAddress'))
    LOC = [('57/257-9-2-18', 'doorNo'), ('57', 'wardNo')]
    TAIL = [('Akkayapalli', 'landmark'), ('Chemmumaiahpeta', 'village'),
            ('Kadapa Municipal Corporation Of Y.S.R. (Dt).', 'localBody')]
    cspan(a, 9, 5, [('492/2B', 'surveyNo')] + LOC + [('Plot No : 14(North Side)', 'plotLine')] + TAIL)
    cspan(a, 9, 5, [('516003', 'pinCode')], para=1)
    cspan(a, 11, 5, [('492/2B', 'surveyNo')])
    cspan(a, 12, 5, [('57/257-9-2-18', 'doorNo'), ('Plot No : 14 (North Side)', 'plotLine')])
    cspan(a, 13, 5, [('Chemmumaiahpeta', 'village')])
    cspan(a, 14, 5, [('57', 'wardNo'), ('Akkayapalli', 'landmark')])
    cspan(a, 15, 5, [('Kadapa Municipal Corporation', 'localBodyName')], para=0)
    cspan(a, 15, 5, [('Y.S.R', 'district')], para=1)
    cspan(a, 16, 5, LOC + [('Plot No : 14 (North Side)', 'plotLine')] + TAIL + [('516003', 'pinCode')])

    b = t[1]
    for r, key in ((0, 'cityTown'), (1, 'areaResidential'), (2, 'areaCommercial'), (3, 'areaIndustrial'),
                   (5, 'areaClass'), (6, 'areaUrban'), (7, 'localBodyType'), (8, 'govtEnactments'),
                   (9, 'agriConversion')):
        cell(b, r, 5, key)
    for r, side in ((12, 'East'), (13, 'West'), (14, 'North'), (15, 'South')):
        cell(b, r, 3, f'bdDeed{side}')
        cell(b, r, 5, f'bdActual{side}')
    for r, side in ((18, 'East'), (19, 'West'), (20, 'North'), (21, 'South')):
        cell(b, r, 3, f'dimDeed{side}')
        cell(b, r, 5, f'dimActual{side}')
    cell(b, 22, 3, 'extentDeed')
    cell(b, 22, 5, 'extentActual')
    cspan(b, 23, 1, [('97.24 Sqyds (or) 81.31 Sqmts (or) 2.01 Cents', 'netExtentPlan')], para=1)
    cell(b, 24, 6, 'gpsDecimal')
    cell(b, 25, 6, 'extentDeed')
    cell(b, 26, 6, 'extentActual')
    cell(b, 27, 6, 'extentConsidered')
    cell(b, 28, 6, 'occupancy')
    chars = ['locality', 'surroundings', 'possibility', 'civicAmenities', 'levelOfLand', 'landShape', 'landUse',
             'usageRestriction', 'layoutApproved', 'cornerPlot', 'roadFacilities', 'roadType', 'roadWidth',
             'landLocked', 'water', 'sewerage', 'power', 'advantage1', 'specialRemarks']
    for i, key in enumerate(chars):
        cell(b, 30 + i, 6, key)

    c = t[2]
    cell(c, 2, 6, 'sizeNorthSouth')
    cell(c, 3, 6, 'sizeEastWest')
    cell(c, 4, 6, 'totalExtent')
    cell(c, 5, 6, 'netExtentPlan')
    cell(c, 6, 6, '', 'marketRateLine')
    cell(c, 7, 6, 'guidelineRateLine')
    cell(c, 8, 6, 'adoptedRateLine')
    cell(c, 9, 6, 'landValueLine')

    g = t[9]
    cell(g, 0, 3, 'absA')
    cell(g, 6, 3, 'absTotal')
    cell(g, 7, 3, 'absSayAs')
    h = t[10]
    cell(h, 1, 2, 'declBackground', '=Pin Code : ' + T('pinCode') + '.')
    cell(h, 2, 2, 'declPurpose')
    cell(h, 5, 2, 'declDates1', 'declDates2', 'declDates3')

    span(doc, 'Rupees Fourteen', '14,07,000', 'fmv')
    span_re(doc, 'Rupees Fourteen', r'\(Rupees.*Only\)', '=(' + T('fmvWords') + ')')
    L = 'Net Realizable Value is'
    span(doc, L, '12,66,000', 'realizable')
    span_re(doc, L, r'\(Rupees [^(]*?Only\)', '=(' + T('realizableWords') + ')')
    span(doc, L, '11,25,000', 'distress')
    span_re(doc, L, r'\(Rupees [^{]*?Only\)', '=(' + T('distressWords') + ')')

    span(doc, 'personally  inspected', '09-03-2026', 'inspectionDate')
    replace_all_body(doc, '09-03-2026', 'reportDate')
    for p in doc.paragraphs:
        tx = para_text(p)
        if 'Place' in tx and 'Kadapa' in tx:
            replace_span(p, 'Kadapa', T('place'))

    mark_images(doc, 'PHOTO’S', 'photo', stop_text='LOCATION')
    mark_region(doc, 'LOCATION – MAP', 'GOOGLE – MAP', '{{img:areaMap:5943600:4114800}}')
    mark_images(doc, 'GOOGLE – MAP', 'map')


# --------------------------------------------------------------------------- OPEN AGRICULTURE LAND
def agriculture(doc):
    t = doc.tables
    span(doc, 'File No', '2602104', 'fileNo')
    _drop_tabs(find_para(doc, 'File No'), 2)
    span(doc, 'District    :', 'Y S R', 'district')
    span(doc, 'MAIN', 'MAIN BRANCH, KADAPA', 'bankBranchUpper')
    span(doc, 'Linga Reddy, S', 'Sri. C. Linga Reddy', 'ownerName')
    span(doc, 'Pedda Reddaiah.', 'S/o. Sri. C. Pedda Reddaiah', 'ownerRelation')
    span_re(doc, 'kadapa city, Y.S.R', r'Modameedapalle.*\.', 'ownerAddress')
    span(doc, 'Deed No     :', '628/2002', 'deedNo')
    span(doc, 'Deed No     :', 'Ac 1.20 Cents', 'extentAc')
    span(doc, 'Khatha No', '2267', 'khathaNo')
    span(doc, 'Khatha No', '777-3P5', 'surveyNo')
    L = 'aluation Report Of'
    span(doc, L, 'Agriculture Land', 'landType')
    span(doc, L, '777-3P5', 'surveyNo')
    span(doc, L, 'Modameedapalle, Patha Kadapa, Near Tata Showroom – Bypass Road', 'landmark')
    span(doc, L, 'Patha Kadapa', 'village')
    span(doc, L, 'Kadapa Municipal Corporation of Y.S.R. (Dt).', 'localBody')
    span(doc, 'Valuation:', '20,40,000', 'fmv')
    span_re(doc, 'TWENTY', r'\(RUPEES.*ONLY\)', '=(' + T('fmvWordsUpper') + ')')
    span_re(doc, 'KADAPA MUNICIPAL CORPORATION', r'KADAPA MUNICIPAL CORPORATION.*\.', 'localBodyUpper')

    a = t[0]
    for r, key in ((1, 'purpose'), (2, 'inspectionDate'), (3, 'valuationDate'), (5, 'saleDeedLine'),
                   (6, 'khathaNo'), (7, 'mvCertificate'), (9, 'tenure'), (16, 'postalAddress'), (17, 'cityTown'),
                   (18, 'areaResidential'), (19, 'areaCommercial'), (20, 'areaIndustrial'), (21, 'areaAgriculture'),
                   (23, 'areaClass'), (24, 'areaUrban'), (25, 'localBodyType'), (26, 'govtEnactments'),
                   (27, 'agriConversion'), (43, 'extentSite'), (44, 'extentConsidered'), (45, 'occupancy'),
                   (65, 'advantage1'), (67, 'specialRemarks'), (69, 'plotShape'), (70, 'sizeNorthSouth'),
                   (71, 'sizeEastWest'), (72, 'totalExtent'), (73, 'marketRateLine'), (74, 'guidelineRateLine'),
                   (75, 'adoptedRateLine'), (76, 'landValueLine')):
        cell(a, r, 9, key)
    set_cell_para(a, 8, 9, 1, T('ownerName') + ', ')
    set_cell_para(a, 8, 9, 2, T('ownerRelation') + '.')
    set_cell_para(a, 8, 9, 3, T('ownerAddress'))
    cspan(a, 11, 9, [('777-3P5', 'surveyNo')])
    cspan(a, 12, 9, [('2267', 'khathaNo')])
    cspan(a, 13, 9, [('Patha Kadapa', 'village')])
    cell(a, 14, 9, '=In ' + T('landmark') + ',')
    cspan(a, 15, 9, [('Kadapa Municipal Corporation', 'localBodyName')], para=0)
    cspan(a, 15, 9, [('Y.S.R', 'district')], para=1)
    for r, side in ((30, 'East'), (31, 'West'), (32, 'North'), (33, 'South')):
        cell(a, r, 7, f'bdDeed{side}')
        cell(a, r, 9, f'bdActual{side}')
    for r, side in ((36, 'East'), (37, 'West'), (38, 'North'), (39, 'South')):
        cell(a, r, 7, f'dimDeed{side}')
        cell(a, r, 9, f'dimActual{side}')
    cell(a, 40, 7, 'extentDeed')
    cell(a, 40, 9, 'extentActual')
    cell(a, 41, 10, 'gpsDms', 'gpsDecimal')
    chars = ['locality', 'surroundings', 'flooding', 'civicAmenities', 'levelOfLand', 'landShape', 'landUse',
             'usageRestriction', 'layoutApproved', 'cornerPlot', 'roadFacilities', 'roadType', 'roadWidth',
             'landLocked', 'water', 'sewerage', 'power']
    for i, key in enumerate(chars):
        cell(a, 47 + i, 9, key)

    cell(t[1], 0, 3, 'absA')
    cell(t[1], 6, 3, 'absTotal')
    cell(t[1], 7, 3, 'absSayAs')
    cell(t[2], 0, 1, 'fmvLine')
    cell(t[2], 1, 1, 'realizableLine')
    cell(t[2], 2, 1, 'distressLine')
    g = t[3]
    cell(g, 1, 2, 'declBackground')
    cell(g, 2, 2, 'declPurpose')
    cell(g, 5, 2, 'declDates1', 'declDates2', 'declDates3')

    L = 'As a result of my appraisal'
    span(doc, L, '20,40,000', 'fmv')
    span_re(doc, L, r'\(Rupees [^)]*Only\)', '=(' + T('fmvWords') + ')')
    span(doc, L, '66,000', 'bookValue')
    span(doc, L, '17,34,000', 'realizable')
    span_re(doc, L, r'\(Rupees [^{)]*Only\)', '=(' + T('realizableWords') + ')')
    span(doc, 'Rupees Fifteen', '15,30,000', 'distress')
    span_re(doc, 'Rupees Fifteen', r'\(Rupees.*Only\)', '=(' + T('distressWords') + ')')

    span(doc, 'personally  inspected', '20-02-2026', 'inspectionDate')
    replace_all_body(doc, '20-02-2026', 'reportDate')
    for p in doc.paragraphs:
        tx = para_text(p)
        if 'Place' in tx and 'Kadapa' in tx:
            replace_span(p, 'Kadapa', T('place'))

    whole(doc, '14°31', T('gpsDms'))
    whole(doc, '14.525611, 78.834194', T('gpsDecimal'))
    mark_region(doc, 'LOCATION – MAP', 'PHOTO’S', '{{img:areaMap:5943600:4114800}}')
    mark_images(doc, 'PHOTO’S', 'photo', stop_text='GOOGLE')
    mark_images(doc, 'GOOGLE – MAP', 'map')
    pct_tags(doc, '85', '75')


FORMATS = {'house': house, 'apartment': apartment, 'open_site': open_site, 'agriculture': agriculture}


def main(args):
    """python3 make_templates.py [apgb|bob] [format …]   (default: apgb, all formats)"""
    bank = 'apgb'
    if args and args[0] in ('apgb', 'bob', 'boi', 'bom', 'canara', 'cbi', 'indian', 'iob', 'karnataka', 'pnb', 'sbi', 'union', 'uco'):
        bank, args = args[0], args[1:]
    formats = FORMATS
    if bank != 'apgb':
        import importlib
        formats = importlib.import_module(f'make_templates_{bank}').FORMATS
    for name in args or list(formats):
        src = os.path.join(HERE, f'{bank}_source', f'{name}.docx')
        out = os.path.join(HERE, 'templates', f'{bank}_{name}.docx')
        doc = docx.Document(src)
        formats[name](doc)
        mark_signatures(doc)
        doc.save(out)
        print('built', out)


if __name__ == '__main__':
    main(sys.argv[1:])

"""
Shriram Finance Ltd: fill-in templates from the lender's own sample reports (shriram_source/*.docx).

Run:  python3 make_templates.py shriram [open_site|house]
Only the sample values are swapped for {{tags}}; the layout, fonts and fixed wording stay as the lender's file.
The form keeps the general details and the location details in tables nested inside the main table.
"""
from make_templates import (T, cell, mark_images, replace_all_body, span, whole)
from make_templates_bob import places
from make_templates_karnataka import signature_before


# --------------------------------------------------------------------------- OPEN SITE
LETTERHEAD_LINES = [  # (left column, right column) of the sample's letterhead, top to bottom
    ('Civil Engineering Consultant,', 'Off : 9052589896'),
    ('Approved PANEL Valuer for:', 'Off : 9440048100'),
    ('A.P.G. Bank, State Bank of India, Karnataka Bank,', 'Door No :- 21/659,'),
    ('Indian Bank, Canara Bank, Bank of Baroda', 'beside Bank of Baroda,'),
    ('Union Bank of India, Bank of India,', '7 Roads, Kadapa,'),
    ('Central Bank Of India, Indian Overseas Bank', 'Y S R (Dist.), A.P.'),
    ('Axis Bank, Hdfc Bank, Icici Bank, Repco, LIC HFL.', None),   # right: the engineer initials
    ('Indian Institution Of Valuers F – 13622.', 'File No:'),
]


def split_letterhead(doc, initials):
    """The sample types its whole letterhead (after the name line) as ONE paragraph and lines the
    right-hand column up with runs of spaces, so every viewer wraps it differently. Rebuild it as one
    paragraph per line — left text, a tab, right text — keeping each piece's own font and colour;
    tidy_letterhead then sets the tab stop for the right column."""
    import copy
    import re
    from docx.oxml.ns import qn
    p = next(p for p in doc.paragraphs[:4] if 'Civil Engineering Consultant' in p.text)
    chars = []  # (character, its run element)
    for r in p._p.iter(qn('w:r')):
        for el in r:
            if el.tag == qn('w:t'):
                chars += [(ch, r) for ch in el.text or '']
            elif el.tag == qn('w:tab'):
                chars.append(('\t', r))
    text = ''.join(c for c, _ in chars)

    def runs_for(piece, start):
        pat = r'\s*'.join(re.escape(w) for w in piece.replace(' ', ''))  # any spacing inside the piece
        m = re.compile(pat).search(text, start)
        if m is None:
            raise ValueError(f'letterhead piece not found: {piece!r}')
        out, cur, buf = [], None, ''
        for ch, r in chars[m.start():m.end()] + [('', None)]:
            if r is not cur and cur is not None:
                out.append((cur, buf))
                buf = ''
            cur = r
            buf += ' ' if ch == '\t' else ch
        return out, m.end()

    def new_run(src, txt):
        r = copy.deepcopy(src)
        for el in list(r):
            if el.tag != qn('w:rPr'):
                r.remove(el)
        t = r.makeelement(qn('w:t'), {})
        t.text = txt
        t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
        r.append(t)
        return r

    pos, new_paras = 0, []
    for left, right in LETTERHEAD_LINES:
        np_ = copy.deepcopy(p._p)
        for el in list(np_):
            if el.tag != qn('w:pPr'):
                np_.remove(el)
        lruns, pos = runs_for(left, pos)
        for r, txt in lruns:
            np_.append(new_run(r, txt))
        rruns, pos = runs_for(right or initials, pos)
        tab = new_run(rruns[0][0], '')
        tab.remove(tab[-1])
        tab.append(tab.makeelement(qn('w:tab'), {}))
        np_.append(tab)
        for r, txt in rruns:
            np_.append(new_run(r, txt))
        new_paras.append(np_)
    tail, _ = runs_for(text[pos:].strip(), pos)  # the file number after "File No:"
    for i, (r, txt) in enumerate(tail):
        new_paras[-1].append(new_run(r, ' ' + txt.lstrip() if i == 0 else txt))
    from docx.shared import Pt
    from docx.text.paragraph import Paragraph
    for np_ in new_paras:
        p._p.addprevious(np_)
        pf = Paragraph(np_, p._parent).paragraph_format
        pf.space_before = pf.space_after = Pt(0)   # one paragraph before, so no gap between its lines
    p._p.getparent().remove(p._p)
    # the name line's indent (-0.79 cm, then +0.79 cm on its first line) cancels out on the page, but the
    # in-app viewer measures its tab from the indent, so its "Cell" sat left of the column: drop it
    name = doc.paragraphs[0].paragraph_format
    name.left_indent = name.first_line_indent = None


def letterhead(doc, file_no, initials):
    """The sample's own file number and engineer initials sit in the letterhead."""
    split_letterhead(doc, initials)
    span(doc, 'File No', file_no, 'fileNo')
    span(doc, 'LIC HFL', initials.strip(), 'engineerInitials')


def open_site(doc):
    letterhead(doc, '2609093', 'HR & YSMN')
    t = doc.tables[0]
    g = t.rows[0].cells[0].tables[0]          # Part 1: general details
    loc = t.rows[40].cells[0].tables[1]       # Part 4: location & other critical details

    cell(g, 1, 1, 'applicantLine', 'owner1AddrA', 'owner1AddrB')
    cell(g, 2, 1, 'bankBranchName')
    cell(g, 3, 1, 'inspectionDate')
    cell(g, 4, 1, 'personMet', '= ', '= ')
    cell(g, 5, 1, '=Door /Flat No: ' + T('doorWard'))
    cell(g, 7, 1, '=Plot No: Survey No: ' + T('plotSurvey'))
    cell(g, 8, 1, '=Street / Area: ' + T('street'))
    cell(g, 9, 1, '=Landmark: ' + T('landmark'))
    cell(g, 10, 1, '=City / Town / Village:  ' + T('villageField'))
    cell(g, 11, 1, '=District / State: ' + T('localBodyLine'))
    cell(g, 12, 1, '=Pin-Code: ' + T('pinCode'))
    cell(g, 13, 1, 'ownerLine1', 'owner1AddrA', 'owner1AddrB')
    cell(g, 15, 1, 'relationWithApplicant')

    cell(t, 7, 3, 'extentFull', '= ')
    cell(t, 10, 3, 'extentFull')
    cell(t, 19, 3, '=Deed No: ' + T('deedNo') + ', Dated: ' + T('deedDate') + '.')
    for r, side in ((21, 'East'), (22, 'West'), (23, 'North'), (24, 'South')):
        cell(t, r, 2, f'bdActual{side}')
    for r, side in ((26, 'East'), (27, 'West'), (28, 'North'), (29, 'South')):
        cell(t, r, 2, f'dimActual{side}')
    cell(t, 30, 2, 'extentFull')
    cell(t, 44, 1, 'areaSqftLine')
    cell(t, 44, 4, 'rateSqftLine')
    cell(t, 44, 5, 'landValueRs')
    cell(t, 47, 5, 'landValueRs')
    cell(t, 48, 5, 'fmvRs')
    cell(t, 50, 5, 'fmvRs')
    cell(t, 51, 5, 'guidelineValueRs')   # under Total Amount (the last column is only 'Source of Valuation')
    cell(t, 52, 5, 'distressRs')
    cell(loc, 5, 1, 'roadWidth')
    cell(loc, 16, 1, 'branchDistance')

    replace_all_body(doc, '23-09-2026', 'reportDate')
    span(doc, 'Signature: ____', '____ / ____ / ______', 'reportDate')  # signed in the app, so dated too
    signature_before(doc, 'Signature: ____')
    places(doc)
    mark_images(doc, 'PHOTOS OF THE PROPERTY', 'photo', stop_text='LOCATION & GOOGLE MAP')
    mark_images(doc, 'LOCATION & GOOGLE MAP', 'map')
    whole(doc, '14°26', T('gpsDms'))
    whole(doc, '14.445497, 78.829295', T('gpsDecimal'))


# --------------------------------------------------------------------------- HOUSE
def house(doc):
    letterhead(doc, '2610159', 'HR ')
    t = doc.tables[0]
    g = t.rows[0].cells[0].tables[0]          # Part 1: general details
    con = t.rows[42].cells[0].tables[0]       # Part 3: construction details
    loc = t.rows[42].cells[0].tables[1]       # Part 4: location & other critical details

    cell(g, 1, 1, 'applicantLine', 'owner1AddrFull')
    cell(g, 2, 1, 'bankBranchName')
    cell(g, 3, 1, 'inspectionDate')
    cell(g, 4, 1, 'personMet')
    cell(g, 5, 1, '=Door /Flat No: ' + T('doorLineH'))
    cell(g, 7, 1, '=Survey / Plot No:  ' + T('surveyPlotH'))
    cell(g, 8, 1, '=Street / Area:  ', 'street')
    cell(g, 9, 1, '=Landmark: ' + T('landmark'))
    cell(g, 10, 1, '=City / Town / Village:  ' + T('villageField'))
    cell(g, 11, 1, '=District/State: ' + T('localBodyLine'))
    cell(g, 12, 1, '=Pin-Code: ' + T('pinCode'))
    cell(g, 13, 1, 'ownerLine1', 'owner1AddrFull')
    cell(g, 15, 1, 'relationWithApplicant')

    cell(t, 7, 3, 'extentDocLine', '= ')
    cell(t, 8, 3, 'extentPlanLine')
    cell(t, 9, 3, 'builtUpLine')
    cell(t, 10, 3, 'carpetLine')
    cell(t, 11, 3, 'extentDocLine', '= ')
    cell(t, 12, 3, 'ageLine')
    cell(t, 13, 3, 'residualLife')
    cell(t, 20, 3, '=Deed No: ' + T('deedNo') + ', Dated: ' + T('deedDateSlash') + '.')
    for r, side in ((22, 'East'), (23, 'West'), (24, 'North'), (25, 'South')):
        cell(t, r, 3, f'bdActual{side}')
    for r, side in ((27, 'East'), (28, 'West'), (29, 'North'), (30, 'South')):
        cell(t, r, 3, f'dimActual{side}')
    cell(t, 31, 3, 'extentDocLine')
    cell(t, 32, 3, 'extentPlanLine')
    for r, key in ((0, 'constructionNature'), (4, 'flooringType'), (10, 'roofingType'), (14, 'floorsWord'),
                   (16, 'completionLine')):
        cell(con, r, 1, key)
    cell(loc, 5, 1, 'roadWidth')
    cell(loc, 16, 1, 'branchDistance')
    cell(t, 45, 1, 'areaSqftLine')
    cell(t, 45, 4, 'rateSqftLine')
    cell(t, 45, 5, 'landValueRs')
    cell(t, 46, 0, '=Building Value ', '=(' + T('floorCodes') + ')')
    cell(t, 46, 1, 'builtSqftLine')
    cell(t, 46, 4, 'buildRateLine')
    cell(t, 46, 5, 'buildingValueRs')
    cell(t, 47, 5, 'otherItemsRs')
    cell(t, 48, 5, 'totalRs')
    cell(t, 49, 5, 'fmvRs')
    cell(t, 51, 7, 'fmvRs')
    cell(t, 52, 7, 'guidelineValueRs')   # under Total Amount (the last column is only 'Source of Valuation')
    cell(t, 53, 7, 'distressRs')

    replace_all_body(doc, '26-10-2026', 'reportDate')
    span(doc, 'Signature: ____', '____ / ____ / ______', 'reportDate')  # signed in the app, so dated too
    signature_before(doc, 'Signature: ____')
    places(doc)
    mark_images(doc, 'PHOTOS OF THE PROPERTY', 'photo', stop_text='LOCATION & GOOGLE MAP')
    mark_images(doc, 'LOCATION & GOOGLE MAP', 'map')
    whole(doc, '14°29', T('gpsDms'))
    whole(doc, '14.492027, 78.813865', T('gpsDecimal'))


FORMATS = {'open_site': open_site, 'house': house}

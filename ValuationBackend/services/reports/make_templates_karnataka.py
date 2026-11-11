"""
Karnataka Bank: fill-in templates from the bank's own sample reports (karnataka_source/*.docx).

Run:  python3 make_templates.py karnataka [house|open_site]
Only the sample values are swapped for {{tags}}; the letterhead, tables, fonts, colours and
fixed wording stay exactly as the bank's file.
"""
from make_templates import (T, span, span_re, whole, cell, mark_images, replace_all_body, set_cell_para)
from make_templates_bob import places
from make_templates_union import location_map


def front(doc, file_no, branch, owner_loc, addr_loc, title_pat, fmv, words, local_line):
    replace_all_body(doc, file_no, 'fileNo')
    span(doc, 'Branch :', branch, 'bankBranchUpper')
    whole(doc, owner_loc, T('ownerLine1'))
    whole(doc, addr_loc, T('owner1Addr'))
    span_re(doc, 'Valuation Report of', title_pat, 'reportTitle')
    span(doc, 'Valuation   :', fmv, 'fmv')
    span(doc, '(RUPEES', words, 'fmvWordsKbl')
    whole(doc, local_line, T('localBodyLine'))


def swap_all(doc, old, new):
    """Replace text wherever it is — body, tables, text boxes."""
    from docx_tools import all_paragraphs, replace_span, para_text
    n = 0
    for p in all_paragraphs(doc):
        while old in para_text(p):
            replace_span(p, old, new)
            n += 1
    if not n:
        raise ValueError(f'{old!r} not found')


def signature_before(doc, text):
    """The engineer's digital signature just above the 'SIGNATURE OF THE VALUER' line."""
    from make_templates import SIGNATURE
    from docx_tools import find_para
    p = find_para(doc, text)
    p.insert_paragraph_before('\t' * 7 + SIGNATURE)


def addr_block(table, r, c):
    cell(table, r, c, 'addressBlock')


# --------------------------------------------------------------------------- HOUSE
def house(doc):
    t = doc.tables
    front(doc, '2610052', 'BANJARAHILLS, HYDERABAD, TELANGANA', 'Meda Raghunadha', 'Chinnaiahgari Palli',
          r'Residential Building \(GF\+FF\) At .*', '8,30,90,000', 'EIGHT CRORES THIRTY LAKHS NINETY THOUSANDS',
          'Rajampeta of Y.S.R (Dt).')
    for i, d in enumerate(['982/2016', '983/2016', '984/2016'], start=1):
        whole(doc, d, T(f'deedLine{i}'))
    span(doc, 'Total Extent   :', '3920.40', 'totalSqyd')
    span(doc, 'Survey No   :', '6/104', 'doorNo')
    span(doc, 'Survey No   :', '68/2', 'surveyNo')
    whole(doc, 'Plan Approval P.R No.03', T('planLine1'))
    whole(doc, 'G.P, Rajampet Mandal, YSR Dist.', T('planLine2'))
    for loc in ('I/We have / My/our representative', 'I have accompanied Sri GOURU'):
        span_re(doc, loc, r'Site Survey No : .*?\(Dt\)\.', 'locationLine')

    a = t[0]
    cell(a, 0, 10, 'purpose')
    cell(a, 1, 10, 'inspectionDate')
    cell(a, 3, 10, 'accompaniedBy', '= ')
    cell(a, 4, 10, 'bankOfficial', 'bankOfficialRole', 'bankOfficialBranch')
    for r in (5, 8):
        addr_block(a, r, 10)
    cell(a, 6, 10, 'ownerLine1', 'owner1Addr')
    cell(a, 7, 10, 'briefDesc', '= ')
    cell(a, 9, 10, '=Site Survey No : ' + T('surveyNo') + ',', '=Door No : ' + T('doorNo') + ',')
    cell(a, 10, 10, 'extentDeedLine')
    cell(a, 11, 10, 'extentPlanLine')
    for k, (head, rows) in enumerate(((13, (14, 15, 16, 17)), (18, (19, 20, 21, 22)), (23, (24, 25, 26, 27))), start=1):
        cell(a, head, 5, f'bd{k}Head')
        for r, side in zip(rows, ('East', 'West', 'North', 'South')):
            cell(a, r, 5, f'bd{k}{side}')
            cell(a, r, 9, f'bd{k}Actual{side}')
    cell(a, 28, 3, 'dimHead')
    for r, side in ((30, 'East'), (31, 'West'), (32, 'North'), (33, 'South')):
        cell(a, r, 5, f'dimDeed{side}')
        cell(a, r, 9, f'dimActual{side}')
    cell(a, 34, 5, 'extentDeedLine')
    cell(a, 34, 9, 'extentDeedLine')
    cell(a, 35, 3, 'netExtentLine')
    cell(a, 36, 9, 'latitude')
    cell(a, 37, 9, 'longitude')
    cell(a, 38, 9, '= YES ', '= ', 'inspectionDate', '=Sketch submitted')
    cell(a, 43, 9, 'roadWidth')
    addr_block(a, 45, 9)
    cell(a, 46, 9, 'constructionType')
    cell(a, 47, 9, 'buildingDesc')
    cell(a, 48, 9, 'constructionType2')
    cell(a, 49, 9, 'planLine1', 'planLine2')
    cell(a, 51, 4, '=As Per Plan : ', 'plinthLines')
    cell(a, 51, 9, '=As Per Actual : ', 'plinthLines')
    for r, key in ((52, 'floorsLine'), (53, 'yearLine'), (54, 'ageLine'), (55, 'remainingLifeLine'), (56, 'totalLifeLine'),
                   (58, 'costLine'), (59, 'depLine'), (60, 'depValueLine'), (62, 'remainingLifeLine'),
                   (92, 'buildingKind'), (93, 'floorsWord'), (95, 'occupancy'), (110, 'costLine'), (111, 'depLine'),
                   (112, 'depValueLine'), (121, 'landValueLine'), (128, 'reportDate'), (130, 'sayLine')):
        cell(a, r, 9, key)
    cell(a, 59, 4, '=Amount of depreciation written down', 'depNote')
    cell(a, 78, 7, 'purchaseYearLine', 'purchasePriceLine')
    cell(a, 77, 7, 'ownedSince')
    addr_block(a, 84, 7)
    cell(a, 116, 9, 'guidelineRateLine', '= ')
    cell(a, 117, 9, 'guidelineValueLine')
    cell(a, 120, 9, '= ', '= ', 'rateSqydLine', '= ', 'landCalc', '= ')
    cell(a, 123, 9, 'totalCalc1', 'totalCalc2', 'totalCalc3')
    cell(a, 131, 9, '= ', 'forcedLine')
    cell(a, 137, 9, '=: Yes, Dt : ' + T('inspectionDate'))

    swap_all(doc, 'Sri. Meda Raghunadha Reddy,S/o. Sri. M. Ramakrishna Reddy.', T('ownerLine1'))
    swap_all(doc, '3920.40  sqyds X  Rs 3100/- Sqyd', T('guidelineCalc'))
    signature_before(doc, 'SIGNATURE OF THE VALUER')
    replace_all_body(doc, '09-10-2026', 'reportDate')
    places(doc)
    mark_images(doc, 'PHOTOS', 'photo', stop_text='LOCATION- MAP')
    mark_images(doc, 'LOCATION- MAP', 'map')


# --------------------------------------------------------------------------- OPEN SITE
def open_site(doc):
    t = doc.tables
    replace_all_body(doc, '2610050', 'fileNo')
    span(doc, 'Branch   :', 'BANJARAHILLS, HYDERABAD, TELANGANA', 'bankBranchUpper')
    whole(doc, 'MRKR Constructions', T('firmLine'))
    whole(doc, 'Represented By Its Owner', T('firmRepLine'))
    whole(doc, 'Meda Madhusudhan', T('ownerLine1'))
    whole(doc, 'C S Reddy Residency', T('owner1Addr'))
    span(doc, '3516/2023', '3516/2023', 'deedNo')
    span(doc, 'Net Extent', '3.685', 'netAcres')
    whole(doc, '3179/2023', T('deedLine2'))
    whole(doc, '2940/2016', T('deedLine3'))
    span(doc, 'Survey No’s  :', '414, 414/2 & 414/3', 'surveyNo')
    span_re(doc, 'Valuation Report  of', r'Residential Vacant Site, .*', 'reportTitle')
    span(doc, 'Valuation: Rs', '20,27,88,000', 'fmv')
    span(doc, '(RUPEES:', 'TWENTY CRORE TWENTY SEVEN LAKHS EIGHTY EIGHT THOUSAND', 'fmvWordsCoreUpper')
    whole(doc, 'Kadapa Municipal Corporation, Y.S.R (Dt).', T('localBodyLine'))

    a = t[0]
    cell(a, 0, 4, 'purpose')
    cell(a, 1, 4, 'inspectionDate')
    cell(a, 3, 4, 'accompaniedBy')
    cell(a, 4, 4, 'bankOfficial', 'bankOfficialRole', '=Karnataka Bank    ', 'bankOfficialBranch', '=' + T('districtDotted') + ' (Dt).')
    addr_block(a, 5, 4)
    cell(a, 6, 4, '=Belongs to:-', 'firmLine', 'firmRepLine', 'ownerLine1', 'owner1Addr')
    cell(a, 7, 4, 'briefDesc')
    cell(a, 8, 4, 'landmarkLine')
    cell(a, 9, 4, '=Site Survey no : ' + T('surveyNo'))
    cell(a, 10, 4, 'extentDeedAc')
    cell(a, 11, 4, 'extentNetAc')
    b = t[1]
    for k, (head, rows) in enumerate(((1, (2, 3, 4, 5)), (6, (7, 8, 9, 10)), (11, (12, 13, 14, 15))), start=1):
        cell(b, head, 4, f'bd{k}Head')
        for r, side in zip(rows, ('East', 'West', 'North', 'South')):
            cell(b, r, 4, f'bd{k}{side}')
            cell(b, r, 7, f'bd{k}Actual{side}')
    cell(b, 16, 2, 'dimHead')
    for r, side in ((17, 'East'), (18, 'West'), (19, 'North'), (20, 'South')):
        cell(b, r, 4, f'dimDeed{side}')
    cell(b, 21, 4, 'extentDeedAc')
    cell(b, 23, 7, 'gpsDecimal')
    cell(b, 24, 7, 'gpsDecimal')
    cell(b, 30, 7, 'roadWidth')
    cell(b, 32, 7, 'surveyBrackets')
    cell(b, 63, 6, 'ownedSince')
    addr_block(b, 69, 6)
    cell(b, 103, 7, 'guidelineRateLine')
    cell(b, 104, 7, 'guidelineValueLine')
    cell(b, 105, 7, 'rateLine2')
    cell(b, 106, 7, 'rateLine2')
    cell(b, 107, 7, 'rateSqydLine', 'landCalc', 'landCalc2', 'sayLine')
    cell(b, 108, 7, 'fmvRs')
    cell(b, 110, 7, 'fmvRs')
    cell(b, 115, 7, 'reportDate')
    cell(b, 117, 7, 'fmvRs')
    cell(b, 118, 7, 'forcedLine')
    cell(t[3], 3, len(t[3].rows[3].cells) - 1, '=: Yes,  Dt : ' + T('inspectionDate'))

    cell(b, 22, 2, '=Note : ', 'noteLine1', 'noteLine2', 'noteLine3')
    cell(b, 64, 6, 'purchaseBlock')
    swap_all(doc, '17835.40 Sqyds  X  Rs 5,600/- Sqyd', T('guidelineCalc'))
    swap_all(doc, 'Door No : 38/241-6, (Survey No : 414, 414/2 & 414/3), Ward No: 38, In Kadapa To Tirupati By Pass Road, '
                  'Opposite Meda Function Hall, Chinnachowk Village, Kadapa Town At Kadapa Municipal Corporation of Y.S.R Dist.',
             T('locationLine'))
    swap_all(doc, 'Sri Meda Madhusudhan Reddy, S/o Sri M. Rama Krishna Reddy.', T('ownerLine1'))
    signature_before(doc, 'SIGNATURE OF THE VALUER')
    replace_all_body(doc, '09-10-2026', 'reportDate')
    places(doc)
    mark_images(doc, 'LOCATION- MAP', 'map')


FORMATS = {'house': house, 'open_site': open_site}

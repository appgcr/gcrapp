"""
Punjab National Bank: fill-in templates from the bank's own sample reports (pnb_source/*.docx).

Run:  python3 make_templates.py pnb [house|apartment|open_site]
Only the sample values are swapped for {{tags}}; the letterhead, tables, fonts, colours and
fixed wording stay exactly as the bank's file.
"""
from docx_tools import find_para
from make_templates import (T, span, span_re, whole, cell, mark_images, replace_all_body, insert_marker_after)
from make_templates_bob import places
from make_templates_union import location_map


def drop_rows(table, *idx):
    """Remove sample rows (the first row stays as the repeating row)."""
    rows = table.rows
    for i in sorted(idx, reverse=True):
        rows[i]._tr.getparent().remove(rows[i]._tr)


def front(doc, file_no, branch, owners, addr, phone):
    """Letterhead page: file no, branch, owners, address, cell no."""
    replace_all_body(doc, file_no, 'fileNo')
    span(doc, 'Branch    :', branch, 'bankBranch')
    for i, loc in enumerate(owners, start=1):
        whole(doc, loc, T(f'ownerLine{i}'))
    span_re(doc, addr, r'Door No :.*', 'owner1Addr')
    if phone:
        span(doc, 'Cell No :', phone, 'ownerPhone')


def owner_cell(table, r, c, numbered=False, belongs=False, address=False):
    tags = ['=Belongs To:- '] if belongs else []
    tags += ['ownerNum1Name' if numbered else 'owner1NameLine', 'owner1RelLine',
             'ownerNum2Name' if numbered else 'owner2NameLine', 'owner2RelLine',
             'ownerNum3Name' if numbered else 'owner3NameLine', 'owner3RelLine']
    if address:
        tags += ['owner1Addr', 'ownerPhoneLine']
    cell(table, r, c, *tags)


# --------------------------------------------------------------------------- HOUSE
def house(doc):
    t = doc.tables
    front(doc, '2604108', 'Seven Road Circle Branch', ['Krishana Reddy,  S/o', 'Bharathi, W/o'],
          '20/941, Co- Operative Colony, Chinnachowk', '9390486732')
    span(doc, 'DEED NO', '4824/2010', 'deedNo')
    span(doc, 'DEED NO', '7.33', 'netExtentCents')
    span(doc, 'SURVEY NO', '20/941', 'doorNo')
    span(doc, 'SURVEY NO', '280/3', 'surveyNo')
    span(doc, 'PLAN APPROVED', 'BPS2025/KDP/KDP/25/015240', 'planNo')
    span(doc, 'PLAN APPROVED', '10-02-2026', 'planDate')
    span_re(doc, 'Valuation Report of', r'Commercial Cum Residential Building.*', 'houseTitle')
    span(doc, 'Valuation   :', '4,99,95,000', 'fmv')
    span(doc, '(RUPEES', 'FOUR CRORE NINETY NINE LAKHS NINETY FIVE THOUSAND', 'fmvWordsCoreUpper')
    whole(doc, 'Kadapa Municipality Of Y.S.R (Dt).', T('localBodyLine'))
    span_re(doc, 'Rs. 4,65,30,000.00', r'Rs\. 4,65,30,000\.00  \(Rupees Four Crore Lakhs Sixty Thousand only\)',
            '=Rs. ' + T('fmv') + '.00  (' + T('fmvWords') + ')')
    span(doc, 'personally inspected the RIGHT', '28-04-2026', 'inspectionDate')
    whole(doc, '7 Road Circle Branch, Kadapa', T('bankBranchLine'))

    a = t[0]
    owner_cell(a, 5, 2)
    cell(a, 6, 2, 'inspectionDate')
    cell(a, 7, 2, '=Doc No. ' + T('deedNo') + ', Dt : ' + T('deedDate') + '.')
    cell(a, 8, 2, 'planLine')
    cell(a, 9, 2, 'valuationDate')
    cell(a, 10, 2, 'purpose')
    owner_cell(a, 11, 2, belongs=True, address=True)
    cell(a, 12, 2, '=Punjab National Bank,  ' + T('bankBranch') + ', ' + T('districtDotted') + ' (Dt) , ')
    cell(a, 14, 2, 'occupancy')
    cell(a, 17, 2, '=Survey no : ' + T('surveyNo') + ', ')
    cell(a, 18, 2, '=Door No : ' + T('doorNo') + ',')
    cell(a, 19, 2, '=In ' + T('landmark') + ',')
    cell(a, 20, 2, '=' + T('village') + '  Village Field,')
    cell(a, 21, 2, '=Ward No : ' + T('wardNo') + ',  ' + T('localBodyName') + ' of ' + T('districtDotted') + ' (Dt).')
    cell(a, 22, 2, 'cityTown')

    b = t[1]
    cell(b, 0, 2, '=Latitude :   ' + T('latitude'), '=Longitude : ' + T('longitude'))
    cell(b, 2, 1, '=Extent of Site as Per Deed    : ' + T('extentYdC'))
    cell(b, 3, 1, '=Net Extent of Site as Per Plan  : ' + T('extentPlanFull'))

    c = t[2]
    for r, side in ((2, 'East'), (3, 'West'), (4, 'North'), (5, 'South')):
        cell(c, r, 3, f'bdDeed{side}')
        cell(c, r, 4, f'bdActual{side}')
    for r, side in ((8, 'East'), (9, 'West'), (10, 'North'), (11, 'South')):
        cell(c, r, 2, f'dimDeed{side}')
        cell(c, r, 4, f'dimActual{side}')
    cell(c, 12, 2, 'extentFtYdC')
    cell(c, 12, 4, 'extentFtYdC')
    cell(c, 13, 1, '= As Per Plan Net Extent :  ' + T('extentPlanFtYdC'))
    cell(c, 14, 4, 'extentConsideredYdC')
    cell(c, 15, 4, '=Survey No : ' + T('surveyNo') + ',')
    cell(c, 16, 4, 'buildingType')
    cell(c, 22, 4, '=Issued  Date : ' + T('planDate') + ' ')
    cell(c, 23, 4, 'planAuthority')
    owner_cell(c, 40, 4, numbered=True)

    d = t[3]
    cell(d, 13, 4, 'yearOfConstruction')
    cell(d, 14, 4, 'remainingLifeLine')
    cell(d, 15, 4, 'totalLifeLine')
    cell(d, 32, 4, 'extentConsideredYdC')
    cell(d, 33, 4, 'rateCentLine')
    cell(d, 34, 4, 'guidelineRateLine')
    cell(d, 35, 4, 'rateCentLine')
    cell(d, 36, 2, '=Estimated value of Land /Site', 'landCalc')
    cell(d, 36, 4, 'landValueLine')
    cell(t[4], 1, 0, '=As Per B.P.S Plan : ', 'plinthLines')

    e = t[5]
    drop_rows(e, 2, 3)
    cell(e, 1, 0, 'fl.sno')
    cell(e, 1, 1, 'fl.label')
    cell(e, 1, 2, 'fl.plinthNum', '=Sqft')
    cell(e, 1, 3, 'fl.height')
    cell(e, 1, 4, 'fl.ageNum', '=Years')
    cell(e, 1, 5, 'fl.rate')
    cell(e, 1, 6, 'fl.replacement')
    cell(e, 1, 7, 'fl.depPct', 'fl.depAmt')
    cell(e, 1, 8, 'fl.net')
    cell(e, 2, 8, 'buildingTotalLine')

    for ti, keys in ((6, ['ex_portico', 'ex_frontDoor', 'ex_sitOut', 'ex_ohTank', 'ex_gates', 'partC']),
                     (7, ['am_wardrobes', 'am_glazedTiles', 'am_sinks', 'am_marble', 'am_interior', 'am_elevation',
                          'am_paneling', 'am_aluminium', 'am_handRails', 'am_falseCeiling', 'partD']),
                     (8, ['mi_toilet', 'mi_lumber', 'mi_sump', 'mi_trees', 'partE']),
                     (9, ['sv_water', 'sv_drainage', 'sv_compoundWall', 'sv_cbDeposits', 'sv_sump', 'sv_lift',
                          'sv_staircase', 'partF'])):
        for r, key in enumerate(keys):
            cell(t[ti], r, 3, key)
    for r, key in enumerate(['absA', 'absB', 'absC', 'absD', 'absE', 'absF', 'absTotal', 'absSayAs']):
        cell(t[10], r, 3, key)
    for r, key in enumerate(['purchaseDate', 'purchasePrice', 'bookValueLine', 'fmvLine', 'realizableLine', 'distressLine']):
        cell(t[11], r, 1, key)
    cell(t[12], 2, 2, '=To avail loan from Punjab National Bank and               Manager, PNB, ' + T('bankBranch')
         + ', ' + T('districtDotted') + ' (Dt) ')
    cell(t[12], 5, 2, 'inspectionDate')

    replace_all_body(doc, '29-04-2026', 'reportDate')
    places(doc)
    location_map(doc, 'LOCATION – MAP', 'Photo’s', close_up=False)
    mark_images(doc, 'Photo’s', 'photo', stop_text='GOOGLE - MAP')
    mark_images(doc, 'GOOGLE - MAP', 'map')


def pending_works(doc, heading='PENDING WORKS', who='Vijaya Bhaskar', who_pat=r'Sri G\. Vijaya.*Reddy\.',
                  total='6,00,000.00', words='SIX LAKHS'):
    """Semi-finished flats: the 'PENDING WORKS' estimate page — title, applicant, the five amounts and the
    total become tags, and the page sits in a cut section that disappears when the flat has no pending works."""
    import re
    from docx_tools import replace_span, para_text
    ps = doc.paragraphs
    start = next(i for i, p in enumerate(ps) if para_text(p).strip() == heading)
    end = next(i for i, p in enumerate(ps) if i > start and words in para_text(p))
    n = 0
    for p in ps[start:end + 1]:
        tx = para_text(p)
        if 'Estimation For The Proposed' in tx:
            replace_span(p, re.search(r'Residential (Semi Finished )?Flat In “.*', tx).group(0), T('aptTitle'))
        elif who in tx:
            replace_span(p, re.search(who_pat, tx).group(0), T('applicantLine'))
        elif 'L.S' in tx and re.search(r'Rs [\d,]+\.00', tx):
            n += 1
            replace_span(p, re.search(r'Rs ([\d,]+\.00)', tx).group(1), T(f'pw{n}'))
        elif total in tx:
            replace_span(p, total, T('pendingTotal'))
        elif words in tx:
            replace_span(p, words, T('pendingWordsCoreUpper'))
    ps[start].insert_paragraph_before('{{cut:pending}}')
    insert_marker_after(ps[end], '{{endcut:pending}}')


# --------------------------------------------------------------------------- APARTMENT
def site_block(table, rows, item, col, label_row=True):
    """One land item of the apartment site: header, East/West/North/South and extent."""
    r0 = rows[0]
    if label_row:
        cell(table, r0, col if col != 3 else 1, f'si{item}Label')
    for r, side in zip(rows[1:5], ('East', 'West', 'North', 'South')):
        cell(table, r, col, f'si{item}{side}')
    if len(rows) > 5:
        cell(table, rows[5], col, f'si{item}Extent')


def apartment(doc):
    t = doc.tables
    replace_all_body(doc, '2603084', 'fileNo')
    span(doc, 'District    :', 'Y.S.R', 'district')
    span(doc, 'Branch     :', 'MAIN BRANCH, KADAPA', 'bankBranchUpper')
    span(doc, 'KALYANA VENKATA NILAYAM”', 'KALYANA VENKATA NILAYAM', 'aptNameUpper')
    span(doc, 'Upper Floor”', 'Stilt + First Floor + 4 Upper Floor', 'floorsDesc')
    span_re(doc, 'Sriram', r'Sri D\. Sriram.*', 'ownerLine1')
    span_re(doc, 'Garudadri', r'Door No:.*', 'owner1Addr')
    span_re(doc, 'Applicant :-', r'Sri G\. Vijaya.*', 'applicantLine')
    span_re(doc, 'Bapuji Road', r'Door No :.*', 'applicantAddr')
    span(doc, 'DEED NO', '4548/2021', 'deedNoA')
    span(doc, '2006.24', '50.62', 'udsSqyd')
    span(doc, 'OUT OF 2006.24', '2006.24', 'parentSqyd')
    span(doc, '5277/2021', '5277/2021', 'deedNoB')
    span(doc, '7335/2023', '7335/2023', 'deedNoC')
    span(doc, 'SURVEY NO', '836/1', 'surveyNo')
    span(doc, 'FLAT NO', '208', 'flatNo')
    span(doc, 'FLAT NO', 'Second Floor', 'floorLine')
    span(doc, 'FLAT NO', '39/308-1-4-5', 'doorNo')
    span(doc, 'PLAN APPROVED UNDER', '1013/1393/B/KAD/cch/2021', 'planNo')
    span(doc, 'PLAN APPROVED UNDER', '11-02-2025', 'planDate')
    span_re(doc, 'Valuation Report of', r'Residential Flat In “.*', 'aptTitle')
    span(doc, 'UN DIVIDED SHARE', '50.62', 'udsSqyd')
    span(doc, 'UN DIVIDED SHARE', '2006.24', 'parentSqyd')
    span(doc, 'Kalyana Venkata Nilayam', 'Kalyana Venkata Nilayam', 'aptName')
    span(doc, 'Valuation Rs', '58,10,000', 'fmv')
    span(doc, '(RUPEES', 'FORTY  SEVEN LAKHS EIGHTY THOUSAND', 'fmvWordsCoreUpper')
    span(doc, 'Realizable Value : Rs', '55,20,000', 'realizable')
    span_re(doc, 'As result of my appraisal', r'Rs\. 58,10,000/- \(Rupees Fifty  Eight Lakhs Ten Thousand only\)',
            '=Rs. ' + T('fmv') + '/- (' + T('fmvWords') + ')')
    span(doc, 'Date of purchase', '16-03-2026', 'purchaseDate')
    span(doc, 'Purchase price', '29,50,000', 'purchaseAmount')
    span(doc, 'Fair market value of immovable', '58,10,000', 'fmv')
    span(doc, 'Realizable value of immovable', '55,20,000', 'realizable')
    span(doc, 'Distress sale value', '52,30,000', 'distress')
    span(doc, 'personally  inspected', '26-03-2026', 'inspectionDate')

    a = t[0]
    for r, key in ((3, 'purpose'), (4, 'inspectionDate'), (5, 'valuationDate'), (12, 'flatDesc'), (16, 'villageLine'),
                   (17, 'landmarkLine'), (18, 'localBodyLine2'), (20, 'planAuthority'), (21, 'planVerified'),
                   (22, 'planComments'), (24, 'cityTown'), (25, 'areaResidential'), (26, 'areaCommercial'),
                   (27, 'areaIndustrial'), (29, 'areaClass'), (30, 'areaUrban'), (31, 'localBodyType'),
                   (32, 'govtEnactments')):
        cell(a, r, 4, key)
    cell(a, 7, 4, 'deedLine1', 'deedLine2', 'deedLine3')
    for r in (8, 19):
        cell(a, r, 4, '=B.A.No :  ' + T('planNo') + ', ', '=Dt : ' + T('planDate') + '.')
    cell(a, 10, 4, '=Belongs To   : -  ', 'owner1NameLine', 'owner1RelLine', 'owner1Addr', 'applicantLabel',
         'applicantName', 'applicantRel', 'applicantAddr')
    cell(a, 11, 4, '=PUNJAB NATIONAL BANK, ' + T('bankBranch') + '.')
    cell(a, 13, 4, 'locationBlock')
    cell(a, 14, 4, '=Survey No  : ' + T('surveyNo') + ',')
    cell(a, 15, 4, '= Flat No :- ' + T('flatNo') + ', ' + T('floorLine') + ', ', '=Door No : ' + T('doorNo'))
    cell(a, 23, 4, '=“' + T('aptNameUpper') + ' APARTMENT”', 'postalLine')
    # Site of the whole apartment: up to five land items (from one or more deeds)
    site_block(a, [34, 35, 36, 37, 38], 1, 3)
    site_block(a, [34, 35, 36, 37, 38], 2, 5)
    cell(a, 34, 5, 'si2Label')
    site_block(a, [40, 41, 42, 43, 44, 45], 'd1', 3)
    cell(a, 40, 1, 'sid1Label')
    site_block(a, [40, 41, 42, 43, 44, 45], 'd2', 5)
    cell(a, 40, 5, 'sid2Label')
    site_block(a, [46, 47, 48, 49, 50, 51], 3, 3)
    cell(a, 46, 1, 'si3Label')
    site_block(a, [46, 47, 48, 49, 50, 51], 4, 5)
    cell(a, 46, 5, 'si4Label')

    b = t[1]
    cell(b, 0, 1, 'si5Label')
    for r, side in zip((1, 2, 3, 4), ('East', 'West', 'North', 'South')):
        cell(b, r, 2, f'si5{side}')
    cell(b, 5, 2, 'si5Extent')
    for r, side in ((8, 'East'), (9, 'West'), (10, 'North'), (11, 'South')):
        cell(b, r, 2, f'fb{side}')
        cell(b, r, 4, f'fbActual{side}')
    cell(b, 15, 2, 'udsLine')
    cell(b, 15, 4, 'udsLine')
    cell(b, 19, 4, '=Latitude   :    ' + T('latitude'))
    cell(b, 20, 4, '=Longitude :   ' + T('longitude'))
    for r, key in ((18, 'udsLine'), (21, 'udsLine'), (22, 'occupancy'), (24, 'aptNameQuoted'), (25, 'localityType'),
                   (26, 'yearOfConstruction'), (27, 'floorsShort'), (28, 'structure'), (29, 'dwellingUnits'),
                   (30, 'quality'), (31, 'appearance'), (32, 'maintenance'), (34, 'lift'), (35, 'protectedWater'),
                   (36, 'sewerage'), (37, 'carParkingType'), (38, 'compoundWall'), (39, 'pavement'),
                   (41, 'floorLine'), (42, 'flatDoorNo'), (44, 'specRoof'), (45, 'specFlooring'), (46, 'specDoors'),
                   (47, 'specWindows'), (48, 'specFittings'), (49, 'specFinishing'), (51, 'assessmentNo'),
                   (52, 'taxPaidName'), (53, 'taxAmountLine'), (56, 'flatMaintenance'), (57, 'deedExecutant'),
                   (58, 'udsLine'), (59, 'plinthLine'), (61, 'carpetLine'), (62, 'flatClass'), (63, 'usage'),
                   (64, 'occupancy2'), (65, 'monthlyRent'), (67, 'marketability'), (68, 'advantages'),
                   (69, 'negatives')):
        cell(b, r, 4, key)

    c = t[2]
    for r, key in ((1, 'comparableRate'), (2, 'adoptedBasicRate'), (9, 'replacementLine'), (10, 'ageLine'),
                   (11, 'lifeLine'), (12, 'deprLine'), (13, 'deprBuildingLine'), (15, 'deprBuildingLine'),
                   (16, 'landValueLine'), (17, 'compositeLine')):
        cell(c, r, 3, key)
    cell(c, 4, 3, 'buildingCalc', 'buildingCalc2')
    cell(c, 5, 3, 'landCalc', 'landCalc2')

    e = t[3]
    cell(e, 1, 2, 'plinthSft')
    cell(e, 1, 3, 'unitRateLine')
    for r, key in ((1, 'compositeLine'), (2, 'carParkingLine'), (3, 'x_wardrobes'), (4, 'x_showcases'),
                   (5, 'x_kitchen'), (6, 'x_superfine'), (7, 'x_interior'), (9, 'x_grills'), (10, 'x_potential'),
                   (11, 'x_others'), (12, 'grandTotalLine'), (13, 'sayLine')):
        cell(e, r, 4, key)
    g = t[4]
    cell(g, 1, 2, 'declBackground')
    cell(g, 2, 2, 'declPurpose')
    cell(g, 5, 2, 'declDates1', 'declDates2', 'declDates3')

    pending_works(doc)
    cell(b, 6, 1, '=Boundaries of the property   (Flat No: ' + T('flatNo') + ', ' + T('floorLine') + ')')
    replace_all_body(doc, '30-03-2026', 'reportDate')
    places(doc)
    location_map(doc, 'LOCATION MAP :', 'Photo’s', close_up=False)
    mark_images(doc, 'Photo’s', 'photo', stop_text='GOOGLE – MAP')
    mark_images(doc, 'GOOGLE – MAP', 'map')


# --------------------------------------------------------------------------- OPEN SITE
def open_site(doc):
    t = doc.tables
    replace_all_body(doc, '2604103', 'fileNo')
    span(doc, 'District   :', 'Y.S.R', 'district')
    span(doc, 'Branch    :', 'SEVEN ROADS  BRANCH, KADAPA', 'bankBranchUpper')
    span_re(doc, 'Khadar Basha.', r'Shaik  Iqabal.*', 'ownerLine1')
    span_re(doc, 'Ravindra Nagar', r'Door No :.*', 'owner1Addr')
    span(doc, 'Deed No    :', '6351/2017', 'deedNo')
    span(doc, 'Deed No    :', '2.71', 'netExtentCents')
    span(doc, 'Survey No   :', '44/34-1-2-8', 'doorNo')
    span(doc, 'Survey No   :', '391/1A & 391/1B', 'surveyNo')
    span(doc, 'Plot No     :', '08 (Part)', 'plotNo')
    span(doc, 'Plan Approved under', 'PER/1013/0201/2026', 'planNo')
    span(doc, 'Plan Approved under', '15-04-2026', 'planDate')
    span_re(doc, 'Valuation Report of', r'Residential Vacant Site At .*', 'siteTitle')
    span(doc, 'Valuation   :', '27,10,000', 'fmv')
    span(doc, '(RUPEES', 'TWENTY SEVEN LAKHS TEN THOUSAND', 'fmvWordsCoreUpper')
    whole(doc, 'KADAPA MUNICIPAL CORPORATION OF', T('localBodyLineUpper'))
    span_re(doc, 'As a result of my appraisal', r'Rs\. 27,10,000/-  \(Rupees Twenty Seven Lakhs Ten Thousand only\)',
            '=Rs. ' + T('fmv') + '/-  (' + T('fmvWords') + ')')

    a = t[0]
    for r, key in ((3, 'inspectionDate'), (4, 'valuationDate'), (5, 'purpose'), (9, 'occupancy'), (14, 'villageLine'),
                   (16, 'localBodyLine2'), (18, 'cityTown'), (19, 'areaResidential'), (21, 'areaClass'),
                   (22, 'areaUrban'), (23, 'localBodyType'), (24, 'siteLocation'), (26, 'extentPlanSqm'),
                   (27, 'extentYdC'), (29, 'surroundings'), (30, 'roadDetails')):
        cell(a, r, 6, key)
    cell(a, 6, 6, '=Belongs To  : -', 'owner1NameLine', 'owner1RelLine', 'owner2NameLine', 'owner2RelLine', 'owner1Addr')
    cell(a, 7, 6, '=Punjab National Bank , ' + T('bankBranch'))
    cell(a, 12, 6, '=Plot No : ' + T('plotNo') + ',  Survey No : ' + T('surveyNo'))
    cell(a, 13, 6, '=Door No : ' + T('doorNo') + ',')
    cell(a, 15, 6, '=Ward No : ' + T('wardNo') + ', ' + T('nearLine'))
    cell(a, 17, 6, '=Ward No : ' + T('wardNo'))
    cell(a, 25, 6, '=Latitude :   ' + T('latitude') + '. ', '=Longitude :  ' + T('longitude') + '.')
    for r, side in ((36, 'East'), (37, 'West'), (38, 'North'), (39, 'South')):
        cell(a, r, 4, f'bdDeed{side}')
        cell(a, r, 7, f'bdActual{side}')
    for r, side in ((42, 'East'), (43, 'West'), (44, 'North'), (45, 'South')):
        cell(a, r, 5, f'dimDeed{side}')
        cell(a, r, 7, f'dimActual{side}')
    cell(a, 46, 5, 'extentYdC2')
    cell(a, 46, 7, 'extentYdC2')
    cell(a, 47, 1, '=Total Extent : ' + T('extentYdC'))
    cell(a, 48, 1, '=As Per Plan Net Extent : ' + T('extentPlanSqm'))
    cell(a, 49, 7, '=Survey No : ' + T('surveyNo') + ',')
    cell(a, 58, 8, '= B.A.No : ' + T('planNo') + ',  ', '=DT : ' + T('planDate'))
    cell(a, 75, 8, '=Deed No : ' + T('deedNo') + ' Dt : ' + T('deedDate'))
    cell(a, 76, 8, '=Belongs To  : -', 'owner1NameLine', 'owner1RelLine', 'owner2NameLine', 'owner2RelLine')
    cell(t[2], 21, 3, '=Land Value :', 'landCalc', 'landCalc2', '= ', '= ')
    cell(t[2], 22, 3, 'landLine', '=Building  =  Rs  ----', 'totalLine', 'sayLine')
    for r, key in enumerate(['absA', 'absB', 'absC', 'absD', 'absE', 'absF', 'absTotal', 'absSayAs']):
        cell(t[3], r, 3, key)
    cell(t[4], 0, 1, 'purchaseDate')
    cell(t[4], 1, 1, 'purchasePrice')
    cell(t[4], 2, 1, 'bookValueLine')
    cell(t[4], 3, 1, 'guidelineCalc', 'guidelineCalc2')
    for r, key in ((4, 'fmvLine'), (5, 'realizableLine'), (6, 'distressLine')):
        cell(t[4], r, 1, key)
    g = t[5]
    cell(g, 1, 2, 'declBackground')
    cell(g, 2, 2, 'declPurpose')
    cell(g, 5, 2, 'declDates1', 'declDates2', 'declDates3')

    span(doc, 'personally  inspected', '25-04-2026', 'inspectionDate')
    replace_all_body(doc, '27-04-2026', 'reportDate')
    places(doc)
    location_map(doc, 'LOCATION MAP:', 'PHOTO’S', close_up=False)
    mark_images(doc, 'PHOTO’S', 'photo', stop_text='GOOGLE  - MAP')
    mark_images(doc, 'GOOGLE  - MAP', 'map')


FORMATS = {'house': house, 'apartment': apartment, 'open_site': open_site}

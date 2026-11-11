"""
Central Bank of India: fill-in templates from the bank's own sample reports (cbi_source/*.docx).

Run:  python3 make_templates.py cbi [house|apartment|open_site]
Only the sample values are swapped for {{tags}}; the letterhead, tables, fonts, colours and
fixed wording stay exactly as the bank's file.
"""
from make_templates import (T, span, span_re, whole, cell, mark_images, replace_all_body)
from make_templates_bob import places, tb_span
from make_templates_union import location_map
from make_templates_pnb import drop_rows

CHARS = ['locality', 'surroundings', 'flooding', 'civicAmenities', 'levelOfLand', 'landShape', 'landUse',
         'usageRestriction', 'layoutApproved', 'cornerPlot', 'roadFacilities', 'roadType', 'roadWidth',
         'landLocked', 'water', 'sewerage']


def owners_front(doc, owner_loc, owner_pat, addr_loc, app_loc=None, app_pat=None, app_addr_loc=None, phone=None):
    span_re(doc, owner_loc, owner_pat, 'ownerLine1')
    span_re(doc, addr_loc, r'\S.*', 'owner1Addr')
    if app_loc:
        whole(doc, 'Applicant :', T('applicantLabel'))
        span_re(doc, app_loc, app_pat, 'applicantLine')
        span_re(doc, app_addr_loc, r'Door No.*', 'applicantAddr')
    if phone:
        span(doc, 'Cell No', phone, 'ownerPhone')


# --------------------------------------------------------------------------- HOUSE
def house(doc):
    t = doc.tables
    replace_all_body(doc, '2602078', 'fileNo')
    span(doc, 'District    :', 'Y.S.R', 'districtDotted')
    span(doc, 'Branch   :', 'KADAPA', 'bankBranchUpper')
    owners_front(doc, 'Phanibhushan', r'Sri A\. Phanibhushan.*', 'Narayana Swamy Nagar',
                 'Rukmini', r'Smt  G\. Rukmini.*', '5/319', '9849921740')
    span(doc, 'Deed No  :', '1172/2012', 'deedNo')
    span(doc, 'Deed No  :', '1.31', 'netExtentCents')
    span(doc, 'Door No   :', '5/41', 'doorNo')
    span(doc, 'Door No   :', '30/2B/1A1', 'surveyNo')
    span(doc, 'APPROVED PLAN:', '501/G/2012', 'planNo')
    span(doc, 'APPROVED PLAN:', '14-09-2012', 'planDate')
    span_re(doc, 'Valuation Report of', r'Residential Building \(GF\+FF\) In .*', 'houseTitle')
    whole(doc, 'Kadapa Municipal Corporation ; Y.S.R (Dt).', T('localBodyLine'))
    tb_span(doc, 'Valuation:', r'25,30,000', 'fmv')
    tb_span(doc, 'RUPEES', r'TWENTY FIVE LAKHS THIRTY THOUSAND', 'fmvWordsCoreUpper')
    whole(doc, 'Rs 25,30,000/-', 'Rs ' + T('fmv') + '/-')
    span(doc, '(RUPEES  TWENTY', 'TWENTY  FIVE LAKHS THIRTY', 'fmvWordsCoreUpper')
    span(doc, 'Market Value', '25,30,000', 'fmv')
    span(doc, 'Releasable Value', '22,77,000', 'realizable')
    span(doc, 'Distressed Value', '20,25,000', 'distress')

    a = t[0]
    for r, key in ((1, 'purposeA'), (2, 'inspectionDate'), (3, 'valuationDate'), (6, 'briefDesc'), (11, 'villageLine'),
                   (13, 'localBodyLine2'), (14, 'postalLine'), (15, 'cityTown'), (16, 'areaResidential'),
                   (18, 'areaClass'), (19, 'areaUrban'), (20, 'localBodyType')):
        cell(a, r, 3, key)
    cell(a, 1, 3, 'purpose', '=Of the Property.')
    cell(a, 4, 3, 'deedLine', '=2) Xerox Copy of Approved Plan ', 'planLine', 'legalOpinion')
    cell(a, 5, 3, '=Belongs To :', 'owner1NameLine', 'owner1RelLine', 'owner1Addr', 'applicantLabel', 'applicantName',
         'applicantRel', 'applicantAddr')
    cell(a, 7, 2, 'buildingDesc')
    cell(a, 9, 3, '=Survey No : ' + T('surveyNo') + ',')
    cell(a, 10, 3, '=Door No : ' + T('doorNo') + ',')
    cell(a, 12, 3, 'wardLine', 'landmarkLine')

    b = t[1]
    cell(b, 0, 3, 'govtEnactments')
    cell(b, 1, 3, 'agriConversion')
    for r, side in ((3, 'East'), (4, 'West'), (5, 'North'), (6, 'South')):
        cell(b, r, 2, f'bdDeed{side}')
    cell(b, 7, 2, 'bd2Head')
    for r, side in ((8, 'East'), (9, 'West'), (10, 'North'), (11, 'South')):
        cell(b, r, 2, f'bd2{side}')
    cell(b, 12, 4, 'dim2Head')
    for r, side in ((13, 'East'), (14, 'West'), (15, 'North'), (16, 'South')):
        cell(b, r, 2, f'dimDeed{side}')
        cell(b, r, 4, f'dim2{side}')
    cell(b, 17, 2, 'item1Extent')
    cell(b, 17, 4, 'item2Extent')
    for r, key in ((18, 'extentDeedLine'), (19, 'extentActualLine'), (20, 'extentPlanLine'), (21, 'extentPlanLine'),
                   (22, 'extentConsideredLine'), (23, 'occupancy'), (24, 'rentLine')):
        cell(b, r, 2, key)

    c = t[2]
    for i, key in enumerate(CHARS):
        cell(c, 1 + i, 3, key)
    for r, key in ((17, 'power'), (18, 'advantage1'), (20, 'disadvantage1'), (21, 'disadvantage2'),
                   (22, 'specialRemarks'), (25, 'sizeNorthSouth'), (26, 'sizeEastWest'), (27, 'totalExtent'),
                   (28, 'extentConsideredLine'), (29, 'marketRateLine'), (30, 'guidelineRateLine'),
                   (31, 'marketRateLine')):
        cell(c, r, 6, key)
    cell(c, 32, 6, 'landCalc', 'landCalc2')
    for r, key in ((35, 'buildingType'), (36, 'constructionType'), (37, 'yearOfConstruction'), (38, 'ageLine'),
                   (39, 'remainingLifeLine'), (40, 'floorsLine'), (42, 'conditionExterior'), (43, 'conditionInterior')):
        cell(c, r, 5, key)
    specs = ['foundation', 'basement', 'superstructure', 'joinery', 'rccWorks', 'plastering', 'flooring',
             'specialFinish', 'roofing', 'drainage']
    for i, key in enumerate(specs):
        cell(c, 46 + i, 4, f'specGF_{key}')

    e = t[3]
    drop_rows(e, 2)
    cell(e, 1, 1, 'plinthActualLines')
    cell(e, 1, 2, 'plinthPlanLines')

    f = t[4]
    drop_rows(f, 2)
    for ci, key in ((0, 'fl.snoDot'), (1, 'fl.label'), (2, 'fl.plinth'), (3, 'fl.height'), (4, 'fl.age'),
                    (5, 'fl.rateSqft'), (6, 'fl.replacement'), (8, 'fl.net')):
        cell(f, 1, ci, key)
    cell(f, 1, 7, 'fl.depPct', 'fl.depAmount')
    cell(f, 2, 8, 'buildingTotalLine')

    for ti, keys in ((5, ['ex_portico', 'ex_frontDoor', 'ex_sitOut', 'ex_ohTank', 'ex_gates', 'partC']),
                     (6, ['am_wardrobes', 'am_glazedTiles', 'am_sinks', 'am_marble', 'am_interior', 'am_elevation',
                          'am_paneling', 'am_aluminium', 'am_handRails', 'am_falseCeiling', 'partD']),
                     (7, ['mi_toilet', 'mi_lumber', 'mi_sump', 'partE']),
                     (8, ['sv_water', 'sv_drainage', 'sv_compoundWall', 'sv_cbDeposits', 'sv_pavement', 'partF'])):
        for r, key in enumerate(keys):
            cell(t[ti], r, 2, key)
    for r, key in enumerate(['absA', 'absB', 'absC', 'absD', 'absE', 'absF', 'absTotal', 'absSayAs']):
        cell(t[9], r, 2, key)
    g = t[10]
    cell(g, 1, 2, 'declBackground')
    cell(g, 2, 2, 'declPurpose')
    cell(g, 5, 2, 'declDates1', 'declDates2', 'declDates3')

    replace_all_body(doc, '16-02-2026', 'reportDate')
    places(doc)
    location_map(doc, 'Location Map', 'Photo’s', close_up=False)
    mark_images(doc, 'Photo’s', 'photo', stop_text='Google  - Map')
    mark_images(doc, 'Google  - Map', 'map')


# --------------------------------------------------------------------------- APARTMENT
def apartment(doc):
    t = doc.tables
    replace_all_body(doc, '2411131', 'fileNo')
    span(doc, 'District    :', 'Y.S.R', 'districtDotted')
    span(doc, 'Branch  :', 'KADAPA', 'bankBranchUpper')
    whole(doc, '“Sri Vijaya Durga Residency”', '“' + T('aptName') + '”')
    span(doc, 'Upper Floors', 'Stilt + First Floor + 5 Upper Floors', 'floorsDesc')
    owners_front(doc, 'Chandra Sekhar,  S/o', r'Sri B\. Chandra.*', 'Flat No: 109, Sri Vijaya')
    span(doc, 'Deed No  :', '6436/2018', 'deedNo')
    span(doc, 'Deed No  :', '0.537', 'udsCents')
    span(doc, 'Flat No     :', '109', 'flatNo')
    span(doc, 'Flat No     :', '1st Floor', 'floorOrdinalLine')
    span(doc, 'Flat No     :', '293/A, 307/C, 310/B', 'surveyNo')
    span(doc, 'Door No  :', '75/1-29', 'doorNo')
    span(doc, 'Approved Plan:', '896/G1/2012', 'planNo')
    span(doc, 'Approved Plan:', '18-11-2012', 'planDate')
    span_re(doc, 'Valuation Report of', r'Residential Flat in “.*', 'aptTitle')
    span(doc, 'UN DIVIDED SHARE', '26.00', 'udsSqyd')
    span(doc, 'UN DIVIDED SHARE', '2444.00', 'parentSqyd')
    whole(doc, 'Sri Vijaya Durga Residency (Residential Apartment)”', '     “' + T('aptName') + ' (Residential Apartment)”')
    span(doc, 'Valuation   :', '28,00,000', 'fmv')
    for p in doc.paragraphs:
        if p.text.strip() == '(RUPEES TWENTY EIGHT LAKHS ONLY)':
            from docx_tools import replace_span
            replace_span(p, 'TWENTY EIGHT LAKHS', T('fmvWordsCoreUpper'))
    whole(doc, 'Rs   28,00,000/-', '\tRs   ' + T('fmv') + '/-')
    span(doc, 'Market Value', '28,00,000', 'fmv')
    span(doc, 'Releasable Value', '26,60,000', 'realizable')
    span(doc, 'Distressed Value', '25,20,000', 'distress')

    a = t[0]
    cell(a, 1, 3, 'purposeFull')
    cell(a, 2, 3, 'inspectionDate')
    cell(a, 3, 3, 'valuationDate')
    cell(a, 4, 3, '=1) Xerox Copy Sale Deed No:-', '= ' + T('deedNo') + '  Dt:- ' + T('deedDate') + '.',
         '=2) Xerox Copy of Approved Plan B.P.S. No: ' + T('planNo') + ',  Dt : ' + T('planDate') + '.', 'taxReceiptLine')
    cell(a, 5, 3, '=Belongs to:', 'owner1NameLine', 'owner1RelLine', 'owner1Addr')
    cell(a, 6, 3, 'aptLocation')
    cell(a, 7, 1, 'buildingDesc')
    cell(a, 9, 2, '=Survey No : ' + T('surveyNo'))
    cell(a, 10, 2, 'flatDoorLine')
    cell(a, 11, 2, 'villageLine')
    cell(a, 12, 2, '=Ward No:- ' + T('wardNo') + ',')
    cell(a, 13, 2, 'localBodyLine2')
    cell(a, 14, 2, 'postalLine')
    b = t[1]
    for r, key in ((0, 'cityTown'), (1, 'areaResidential'), (3, 'areaClass'), (4, 'areaUrban'), (5, 'localBodyType'),
                   (6, 'govtEnactments'), (7, 'agriConversion')):
        cell(b, r, 4, key)
    for r, side in ((9, 'East'), (10, 'West'), (11, 'North'), (12, 'South')):
        cell(b, r, 3, f'bdDeed{side}')
    for r, side in ((14, 'East'), (15, 'West'), (16, 'North'), (17, 'South')):
        cell(b, r, 3, f'dimDeed{side}')
    cell(b, 18, 3, 'parentLine')
    cell(b, 19, 3, '=Flat No:- ' + T('flatNo'))
    for r, side in ((20, 'East'), (21, 'West'), (22, 'North'), (23, 'South')):
        cell(b, r, 3, f'fb{side}')
    for r in (25, 26, 27, 28, 29):
        cell(b, r, 2, 'udsOutOf')
    c = t[2]
    cell(c, 0, 4, 'udsLine')
    cell(c, 1, 4, 'occupancy')
    cell(c, 2, 4, 'rentLine')
    for i, key in enumerate(CHARS):
        cell(c, 4 + i, 4, key)
    cell(c, 12, 4, '=Yes, Plan Approval B.P.S. No: ' + T('planNo') + '  ', '=Dt : ' + T('planDate'))
    for r, key in ((20, 'power'), (21, 'advantage1'), (22, 'advantage2'), (23, 'disadvantage1'), (24, 'disadvantage2'),
                   (25, 'specialRemarks')):
        cell(c, r, 5, key)
    d = t[3]
    for r, key in ((2, 'udsLine'), (3, 'udsLine'), (4, 'udsCentsLine'), (5, 'marketRateLine'), (6, 'guidelineNote'),
                   (7, 'marketRateLine')):
        cell(d, r, 3, key)
    cell(d, 8, 3, 'landCalc', 'landCalc2')
    for r, key in ((11, 'buildingType'), (12, 'constructionType'), (13, 'yearAgeLine'), (14, 'floorLineComma'),
                   (16, 'conditionExterior'), (17, 'conditionInterior')):
        cell(d, r, 2, key)
    specs = ['foundation', 'basement', 'superstructure', 'joinery', 'rccWorks', 'plastering', 'flooring',
             'specialFinish', 'roofing', 'drainage']
    for i, key in enumerate(specs):
        cell(d, 20 + i, 2, f'specGF_{key}')
    cell(t[4], 7, 2, '=    Flat No :-  ' + T('flatNo') + ' = ' + T('plinthLine'))
    e = t[5]
    for ci, key in ((0, 'fl.snoDot'), (1, 'fl.label'), (2, 'fl.plinth'), (3, 'fl.height'), (4, 'fl.age'),
                    (5, 'fl.rateSqft'), (6, 'fl.replacement'), (8, 'fl.net')):
        cell(e, 1, ci, key)
    cell(e, 1, 7, 'fl.depPct', 'fl.depAmount')
    cell(e, 2, 8, 'buildingTotalLine')
    for ti, keys in ((6, ['ex_portico', 'ex_frontDoor', 'ex_sitOut', 'ex_ohTank', 'ex_gates', 'partC']),
                     (7, ['am_wardrobes', 'am_glazedTiles', 'am_sinks', 'am_marble', 'am_interior', 'am_elevation',
                          'am_paneling', 'am_aluminium', 'am_handRails', 'am_falseCeiling', 'partD']),
                     (9, ['sv_water', 'sv_drainage', 'sv_compoundWall', 'sv_cbDeposits', 'sv_pavement', 'partF'])):
        for r, key in enumerate(keys):
            cell(t[ti], r, 2, key)
    cell(t[8], 0, 2, 'mi_toilet')
    cell(t[8], 3, 2, 'partE')
    for r, key in enumerate(['absA', 'absB', 'absC', 'absD', 'absE', 'absF', 'absTotal', 'absSayAs']):
        cell(t[10], r, 2, key)
    g = t[11]
    cell(g, 1, 2, 'declBackground')
    cell(g, 2, 2, '=For collateral security. Manager, ', 'declPurposeLine')
    cell(g, 5, 2, 'declDates1', 'declDates2', 'declDates3')

    span(doc, 'personally inspected', '21-11-2024', 'inspectionDate')
    replace_all_body(doc, '22-11-2024', 'reportDate')
    places(doc)
    location_map(doc, 'LOCATION MAP', 'PHOTO’S', close_up=False)
    mark_images(doc, 'PHOTO’S', 'photo')


# --------------------------------------------------------------------------- OPEN SITE
def open_site(doc):
    t = doc.tables
    replace_all_body(doc, '2503016', 'fileNo')
    span(doc, 'District    :', 'Y.S.R', 'districtDotted')
    span(doc, 'Branch :', 'KADAPA BRANCH', 'bankBranchUpper')
    whole(doc, 'Sri. C. Bhaskar Reddy,', T('owner1NameLine'))
    span_re(doc, 'C. Krishna Reddy.', r'S/o\. Sri\. C\. Krishna Reddy\.', 'owner1RelPlain')
    whole(doc, 'Applicant :-', T('applicantLabel'))
    whole(doc, 'Chenna Kesavulu', T('applicantName'))
    span_re(doc, 'R. Reddaiah.', r'S/o\. Sri\. R\. Reddaiah\.', 'applicantRelPlain')
    span(doc, 'Fair Market Value Of Above', '66,17,000', 'fmv')
    span(doc, 'The Realizable value', '59,55,000', 'realizable')
    span(doc, 'The distress Value', '52,93,000', 'distress')
    span_re(doc, 'Valuation  Report  of', r'Residential Vacant Site In .*Dist\.', 'siteTitle')
    whole(doc, 'Rs   66,17,000/-', 'Rs   ' + T('fmv') + '/-')
    span(doc, '(RUPEES SIXTY', 'SIXTY SIX LAKHS SEVENTEEN THOUSANDS', 'fmvWordsCoreUpper')
    span(doc, 'Market Value \t', '66,17,000', 'fmv')
    span(doc, 'Releasable Value', '59,55,000', 'realizable')
    span(doc, 'Distressed Value', '52,93,000', 'distress')

    a = t[1]
    for r, key in ((1, 'purpose'), (2, 'inspectionDate'), (3, 'valuationDate'), (9, 'doorLine'), (10, 'villageLine'),
                   (11, 'wardLine'), (13, 'postalLine'), (14, 'cityTown'), (15, 'areaResidential')):
        cell(a, r, 3, key)
    cell(a, 4, 3, '=Deed No :  ' + T('deedNo') + ', Date : ' + T('deedDate') + '.')
    cell(a, 5, 3, '=Belongs To : -', 'owner1NameLine', 'owner1RelLine', 'owner1Addr', 'applicantLabel2', 'applicantName',
         'applicantRel', 'applicantAddr')
    cell(a, 6, 3, 'siteTitle')
    cell(a, 8, 3, '=Survey No : ' + T('surveyNo') + ', Plot  No: ' + T('plotNo') + ',')
    cell(a, 12, 3, '=' + T('localBodyName') + ' Of ', '=' + T('districtDotted') + ' (Dt).')
    b = t[2]
    for r, key in ((1, 'areaClass'), (2, 'areaUrban'), (3, 'localBodyType')):
        cell(b, r, 6, key)
    cell(b, 4, 4, 'govtEnactments')
    cell(b, 5, 4, 'agriConversion')
    for r, side in ((7, 'East'), (8, 'West'), (9, 'North'), (10, 'South')):
        cell(b, r, 4, f'bdDeed{side}')
        cell(b, r, 7, f'bdActual{side}')
    for r, side in ((12, 'East'), (13, 'West'), (14, 'North'), (15, 'South')):
        cell(b, r, 4, f'dimDeed{side}')
        cell(b, r, 7, f'dimActual{side}')
    cell(b, 16, 4, 'extentDeedLine')
    cell(b, 16, 7, 'extentDeedLine')
    for r, key in ((17, 'extentDeedLine'), (18, 'extentPlanLine'), (19, 'extentConsideredLine'), (20, 'occupancy'),
                   (21, 'rentLine')):
        cell(b, r, 5, key)
    c = t[3]
    for i, key in enumerate(CHARS):
        cell(c, 1 + i, 3, key)
    for r, key in ((17, 'power'), (18, 'advantage1'), (19, 'disadvantage1'), (20, 'disadvantage2'),
                   (21, 'specialRemarks'), (24, 'extentDeedLine'), (25, 'extentDeedLine'), (26, 'extentConsideredLine')):
        cell(c, r, 4, key)
    d = t[4]
    cell(d, 0, 2, 'marketRateLine')
    cell(d, 1, 2, 'guidelineRateLine')
    cell(d, 2, 2, 'marketRateLine')
    cell(d, 3, 2, 'landCalc', 'landCalc2')
    for r, key in ((0, 'absA'), (6, 'absTotal'), (7, 'absSayAs')):
        cell(t[5], r, 2, key)
    g = t[6]
    cell(g, 1, 2, 'declBackground')
    cell(g, 2, 2, 'declPurpose')
    cell(g, 5, 2, 'declDates1', 'declDates2', 'declDates3')

    span(doc, 'personally inspected', '05-03-2025', 'inspectionDate') if any('05-03-2025' in p.text and 'personally' in p.text for p in doc.paragraphs) else None
    replace_all_body(doc, '06-03-2025', 'reportDate')
    places(doc)
    location_map(doc, 'LOCATION - MAP', 'PHOTO’S', close_up=False)
    mark_images(doc, 'PHOTO’S', 'photo', stop_text='GOOGLE – MAP')
    mark_images(doc, 'GOOGLE – MAP', 'map')


FORMATS = {'house': house, 'apartment': apartment, 'open_site': open_site}

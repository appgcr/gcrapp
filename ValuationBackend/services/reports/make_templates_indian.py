"""
Indian Bank: fill-in templates from the bank's own sample reports (indian_source/*.docx).

Run:  python3 make_templates.py indian [open_site]
Only the sample values are swapped for {{tags}}; the letterhead, tables, fonts, colours and
fixed wording stay exactly as the bank's file. (House and apartment samples are old .doc files —
they are added once the bank's files are re-saved as .docx.)
"""
from make_templates import (T, span, span_re, whole, cell, mark_images, replace_all_body)
from make_templates_bob import places
from make_templates_union import location_map
from make_templates_karnataka import signature_before
from make_templates_pnb import drop_rows


# --------------------------------------------------------------------------- OPEN SITE
def open_site(doc):
    t = doc.tables
    replace_all_body(doc, '2604045', 'fileNo')
    span(doc, 'District   :', 'Y.S.R', 'districtDotted')
    span(doc, 'Branch   :', 'RAJIV PARK BARNCH, KADAPA', 'bankBranchUpper')
    whole(doc, 'Chennarayudu, S/o', T('ownerLine1'))
    whole(doc, 'Khajipeta Village', T('owner1Addr'))
    whole(doc, 'Applicant  :', T('applicantLabel'))
    whole(doc, 'Govardhan, S/o. Sri  V . Narasimhulu.', T('applicantLine'))
    whole(doc, 'Velagacherla Village, Pengaluru Mandal, Y.S.R (Dt).', T('applicantAddr'))
    span(doc, 'Deed No    :', '1323/1979', 'deedNo')
    span(doc, 'Net Extent', '93.78', 'netSqyd')
    whole(doc, 'Will  Deed No', T('deed2PlotLine'))
    span(doc, 'East Side Door No', '57/512-1', 'doorNo')
    span(doc, 'East Side Door No', '40', 'surveyNo')
    span(doc, 'PLAN APPROVED NO', 'Tentative Plan', 'planNo')
    span_re(doc, 'Valuation Report Of', r'Residential Vacant Site In .*', 'siteTitle')
    span(doc, 'Valuation Rs', '27,15,000', 'fmv')
    span(doc, '(Rupees', 'TWENTY SEVEN LAKHS FIFTEEN THOUSAND', 'fmvWordsCoreUpper')
    whole(doc, 'Kadapa Municipal Corporation of Y.S.R (Dt).', T('localBodyLine'))
    span(doc, 'Realizable Value: Rs', '24,40,000', 'realizable')
    span_re(doc, 'Pursuant to the request', r'(?<=The Manager, ).*?(?= The Property)', 'bankBranchLine')
    span_re(doc, 'Pursuant to the request', r'(?<=The Property is at ).*?(?= Which is)', 'locationLine')
    span_re(doc, 'Pursuant to the request', r'(?<=Applicant by  ).*?(?= was inspected)', 'applicantLine2')
    span(doc, 'Pursuant to the request', '13-04-2026', 'inspectionDate')
    whole(doc, 'Deed Xerox :  1323/1979', T('deedXerox1'))
    whole(doc, 'Will Deed Xerox', T('deedXerox2'))
    span(doc, 'Xerox Copy Of Plan Approval', 'Tentative Plan', 'planNo')
    span(doc, 'fair market value of the property', '27,15,000', 'fmv')
    span(doc, 'comparable sale value', '24,40,000', 'realizable')
    span(doc, 'Forced sale value', '21,72,000', 'distress')
    span(doc, 'I have inspected the property on', '13-04-2026', 'inspectionDate')
    span(doc, 'I have inspected the property on', 'Sri T. Ramalingaiah', 'bankOfficial')
    span_re(doc, 'Branch      ', r'Rajiv Park Branch, Kadapa, Y\.S\.R \(Dt\),', 'bankBranchLine2')
    span_re(doc, 'Customer           :', r'Sri V \. Govardhan.*', 'applicantLine2')

    a = t[0]
    cell(a, 0, 2, '=Belongs to :-', 'tableOwnerLine', 'tableOwnerAddr')
    cell(a, 1, 2, '=Deed No : ' + T('deedNo'), 'roLine', '=Verified', '=S. No’s : ' + T('surveyNo') + ',',
         'extentDeedLine', 'extentPlanLine', 'planNo')
    for r, side in ((3, 'East'), (4, 'West'), (5, 'North'), (6, 'South')):
        cell(a, r, 3, f'dimDeed{side}')
    for r, side in ((9, 'East'), (10, 'West'), (11, 'North'), (12, 'South')):
        cell(a, r, 3, f'dimActual{side}')
    cell(a, 7, 3, 'extentFull')
    cell(a, 13, 3, 'extentFull')
    cell(a, 14, 3, 'extentPlanLine')
    cell(a, 15, 3, 'landType')
    cell(a, 16, 3, 'locationLine')
    for r, side in ((19, 'East'), (20, 'West'), (21, 'North'), (22, 'South')):
        cell(a, r, 3, f'bdDeed{side}')
    for r, side in ((24, 'East'), (25, 'West'), (26, 'North'), (27, 'South')):
        cell(a, r, 3, f'bdActual{side}')
    cell(a, 29, 3, 'buyerLines')
    cell(a, 30, 3, 'sellerLines')
    for r, key in ((31, 'extentDeedYdC'), (32, 'registeredFor'), (33, 'registrationDates'), (44, 'inspectionLine'),
                   (47, 'guidelineRateLine'), (48, 'marketRateLine')):
        cell(a, r, 3, key)
    cell(a, 49, 3, 'landCalc', 'landCalc2', 'sayLine', 'fmvRs', 'realizableRs', 'distressRs')

    signature_before(doc, 'Signature (with seal)')
    replace_all_body(doc, '15-04-2026', 'reportDate')
    places(doc)
    location_map(doc, 'LOCATION – MAP', 'Photo’s', close_up=False)
    mark_images(doc, 'Photo’s', 'photo', stop_text='Google – Map')
    mark_images(doc, 'Google – Map', 'map')


# --------------------------------------------------------------------------- HOUSE
def house(doc):
    """House (the bank's Rajiv Park layout, sample 2509071): front page with up to two deeds, summary letter,
    land summary (table 0, two deeds side by side), building summary (tables 1–3)."""
    t = doc.tables
    replace_all_body(doc, '2509071', 'fileNo')
    span(doc, 'District   :', 'Y.S.R', 'districtDotted')
    span(doc, 'Branch    :', 'RAJIV PARK BARNCH, KADAPA', 'bankBranchUpper')
    whole(doc, 'Chandravathi, W/o. Sri. M. Harikishan', T('ownerLine1'))
    whole(doc, '101/257-8-6, Sinareddy Green City', T('owner1Addr'))
    span(doc, 'A - Schedule', '2212/2022', 'deedNo')
    span(doc, 'A - Schedule', '7.44', 'deed1Cents')
    span(doc, 'A - Schedule', 'A - Schedule', 'deed1Label')
    whole(doc, 'Deed No    :  9366/2025', T('deed2Front'))
    span(doc, 'Plot No     :', '06 & 07', 'plotNo')
    span(doc, 'Plot No     :', '12.95', 'totalCents')
    span(doc, 'Door No’s  :', '101/257-8-6', 'doorNo')
    whole(doc, '190/2,191,193,194,195/1 & 198', T('dropLine'))          # survey list continued (page 1)
    whole(doc, 'Survey No  :', '  Survey No  :   ' + T('surveyNo'))
    whole(doc, 'Plan Approved Under', T('planHeadLine'))
    span_re(doc, 'Valuation Report of Residential Building', r'Residential Building .*', 'houseTitle')
    whole(doc, '189/2,190/1,190/2,191,193,194,195/1 & 198, Door No', T('dropLine'))   # title continued
    span(doc, 'Valuation   :  Rs', '2,16,95,000', 'fmv')
    span(doc, '(Rupees :  TWO CRORE', 'TWO CRORE SIXTEEN LAKHS NINETY FIVE THOUSAND', 'fmvWordsCoreUpper')
    span(doc, '(Rupees :  TWO CRORE', 'TWO CRORE SIXTEEN LAKHS NINETY FIVE THOUSAND', 'fmvWordsCoreUpper')
    whole(doc, 'Kadapa Municipal Corporation Of Y.S.R (Dt).', T('localBodyLine'))
    span(doc, 'Realizable Value : Rs', '2,06,10,000', 'realizable')
    span_re(doc, 'Pursuant to the request', r'(?<=The Manager, ).*?(?= The property)', 'bankBranchLine')
    span_re(doc, 'Pursuant to the request', r'(?<=The property is at ).*', 'locationLine')
    whole(doc, 'Which is Belongs to', ' Which is Belongs to  ' + T('ownersAnd'))
    span(doc, 'was inspected on', '09-09-2025', 'inspectionDate')
    whole(doc, 'Deed Of Exchange Deed Xerox', T('deedXerox1'))
    whole(doc, 'Settlement Deed No', T('deedXerox2'))
    whole(doc, 'Xerox Copy Of Plan Approval', T('planXeroxLine'))
    whole(doc, 'Dt : 21-05-2022.', T('dropLine'))
    span(doc, 'fair market value of the property', '2,16,95,000', 'fmv')
    span(doc, 'comparable sale value', '2,06,10,000', 'realizable')
    span(doc, 'Forced sale value of the property', '1,95,25,000', 'distress')
    span(doc, 'I have inspected the property on', '01-12-2025', 'inspectionDate')
    span(doc, 'I have inspected the property on', 'Sri T . Ramalingaiah', 'bankOfficial')
    span_re(doc, 'Branch         :', r'Rajiv Park Branch, Kadapa, Y\.S\.R\.Dt\.', 'bankBranchLine2')
    span_re(doc, 'Customer    :', r'Smt M \. Chandravathi.*', 'ownersAnd')

    a, b, c2, c3 = t[0], t[1], t[2], t[3]
    cell(a, 0, 7, '=Belongs To  : -', 'tOwner1', 'tOwner2', 'owner1Addr')
    cell(a, 1, 7, 'deedLine1', 'deedLine2', 'roLine', '=Verified', 'surveyLineC', 'asPerDeedLine', 'asPerPlanLine')
    cell(a, 2, 5, '=As per Deed ( ' + T('deed1No') + ')')
    cell(a, 2, 9, 'deed2Head')
    for r, side in ((3, 'East'), (4, 'West'), (5, 'North'), (6, 'South')):
        cell(a, r, 5, f'dimDeed{side}')
        cell(a, r, 9, f'dim2{side}')
    cell(a, 7, 5, 'extent1Full')
    cell(a, 7, 9, 'extent2Full')
    cell(a, 8, 9, 'planExtA', 'planExtB', 'planExtC')
    cell(a, 9, 9, 'landType')
    cell(a, 10, 9, 'locationLine')
    cell(a, 12, 2, '=Boundaries   As Per Deed ( ' + T('deed1No') + ')')
    cell(a, 12, 8, 'deed2HeadB')
    for r, side in ((13, 'East'), (14, 'West'), (15, 'North'), (16, 'South')):
        cell(a, r, 4, f'bdDeed{side}')
        cell(a, r, 10, f'bd2{side}')
    for r, side in ((18, 'East'), (19, 'West'), (20, 'North'), (21, 'South')):
        cell(a, r, 4, f'bdActual{side}')
    for r, key in ((23, 'buyerLines'), (24, 'sellerLines'), (25, 'extentYdLines'), (26, 'registeredFor'),
                   (27, 'registrationDates')):
        cell(a, r, 10, key)
    cell(a, 35, 11, 'surfaceComm')
    cell(a, 38, 12, '= Yes , ', 'assessmentLine', 'taxPaidLine', 'taxPaidName')
    cell(a, 39, 12, 'inspectionDate', '=Building', '=Not Applicable')
    cell(a, 42, 12, 'guidelineRateLine', '= ')
    cell(a, 43, 12, 'marketRateLine', 'adoptedRateLine')
    cell(a, 44, 12, 'landCalc', 'landCalc2', 'landMarketRs', 'landRealizableRs', 'landDistressRs', 'landMarketRs')

    cell(b, 0, 6, '=Belongs To  : -', 'owner1NameLine', 'owner1RelLine', 'tOwner2', '= ')
    cell(b, 1, 6, 'deedLine1', 'deedLine2', 'roLine')
    cell(b, 2, 6, '=Verified', 'surveyLineC')
    cell(b, 3, 6, 'totalYdCLine')
    cell(b, 4, 6, 'planExtA', 'planExtBC')
    cell(b, 5, 6, 'locationLine')
    for r, side in ((8, 'East'), (9, 'West'), (10, 'North'), (11, 'South')):
        cell(b, r, 2, f'bdDeed{side}')
        cell(b, r, 5, f'bdActual{side}')
    for r, key in ((1, 'buyerLines'), (2, 'sellerLines'), (3, 'extentYdLines'), (4, 'registeredFor'),
                   (5, 'registrationDates'), (13, 'deviations'), (14, 'ageLine'), (15, 'lifeLine'), (18, 'taxAmountLine')):
        cell(c2, r, 3, key)
    cell(c2, 9, 3, 'tenancy', '= ')
    cell(c2, 12, 3, 'planBuilt', 'planNoLine', 'planDateLine', '= ')
    for r, key in ((1, 'buildingUse'), (2, 'occupancy'), (3, 'rentLine')):
        cell(c3, r, 4, key)
    cell(c3, 7, 2, 'totalYdCLine')
    cell(c3, 8, 2, 'plinthActual')
    cell(c3, 9, 1, 'plinthNote')
    for r, key in ((10, 'plinthPlan'), (11, 'yearOfConstruction'), (12, 'structureType'), (13, 'roofType'),
                   (14, 'floorType'), (15, 'replacementLines'), (16, 'replacementTotal'), (17, 'depLine'),
                   (18, 'buildingValue'), (19, 'buildingDistress'), (24, 'busStop'), (25, 'railwayStation'),
                   (26, 'guidelineRateLine'), (30, 'fmvRs'), (31, 'realizableRs'), (32, 'distressRs'), (33, 'fmvRs')):
        cell(c3, r, 3, key)
    cell(c3, 16, 1, '=Estimates /Present value (' + T('floorCodes') + ')')
    cell(c3, 17, 1, '=Less:-   Depreciation ' + T('depPctNum') + ' %  (Rs. in lacs)')
    cell(c3, 27, 3, 'marketRateLine', 'adoptedRateLine')
    cell(c3, 28, 3, 'landCalc', 'landCalc2')
    cell(c3, 29, 1, '=Total Site + Building (' + T('floorCodes') + ')\t', '=Amenities/Extra fittings', '= ')
    cell(c3, 29, 3, 'absLand', 'absBuilding', 'absTotal', 'absSay')
    cell(c3, 30, 1, '=Market Value (' + T('floorCodes') + ')')

    signature_before(doc, 'Signature (with seal)')
    replace_all_body(doc, '02-12-2025', 'reportDate')
    places(doc)
    location_map(doc, 'LOCATION – MAP', 'PHOTO’S', close_up=False)
    mark_images(doc, 'PHOTO’S', 'photo', stop_text='Google Map')
    mark_images(doc, 'Google Map', 'map')
    whole(doc, '14°26', T('gpsDms'))
    whole(doc, '14.443903, 78.815571', T('gpsDecimal'))


def drop_from_second_letterhead(doc):
    """The sample ends with the valuer's own fee invoices (a second letterhead onward) — Gouru makes its
    invoices separately, so those pages are not part of the bank's report."""
    from docx.oxml.ns import qn
    body = doc.element.body
    kids = list(body.iterchildren())
    text = lambda el: ''.join(t.text or '' for t in el.iter(qn('w:t')))  # noqa: E731
    heads = [i for i, el in enumerate(kids) if el.tag == qn('w:p') and 'Neelakanta Reddy' in text(el)
             and ('B. Tech' in text(el) or 'B.Tech' in text(el))]
    if len(heads) < 2:
        return
    start = heads[1]
    while start > 0 and kids[start - 1].tag == qn('w:p') and not text(kids[start - 1]).strip() \
            and kids[start - 1].find('.//' + qn('w:drawing')) is None:
        start -= 1
    for el in kids[start:]:
        if el.tag != qn('w:sectPr'):
            body.remove(el)


# --------------------------------------------------------------------------- APARTMENT
def apartment(doc):
    """Residential flat(s). The sample covers four flats in one report (two flat-boundary blocks per row,
    two rows); the template keeps one row: the case's flat on the left and an optional second flat on
    the right. Two deeds are allowed (the second line drops when there is none)."""
    t = doc.tables
    drop_from_second_letterhead(doc)
    replace_all_body(doc, '2609106', 'fileNo')
    span(doc, 'District   :', 'Y.S.R', 'districtDotted')
    span_re(doc, 'Branch   :  RAJIV', r'RAJIV PARK  BRANCH, KADAPA\.', 'bankBranchUpper')
    span(doc, '“ PGR RESIDENCY”', 'PGR RESIDENCY', 'aptNameUpper')
    span_re(doc, 'Stilt + Ground', r'Stilt.*Floor', 'aptFloorsLine')
    whole(doc, 'Prasanthi, W/o Sri R . Sambasiva Reddy.', T('ownerLine1'))
    whole(doc, '45/228, Balaji Nagar', T('owner1Addr'))
    span(doc, '1381/2008           ', '1381/2008', 'deedNo')
    span(doc, 'EXTENT        :', '89.37', 'udsSqyd')
    whole(doc, 'DEED NO   :   4743/2022', T('deed2Front'))
    span(doc, 'FLAT NO    :', '301,302,303 & 304  (Second Floor)', 'flatLine')
    span(doc, 'FLAT NO    :', '557/2 & 560', 'surveyNo')
    span(doc, 'DOOR NO :', '45/299-7', 'doorNo')
    whole(doc, 'PLAN APPROVED UNDER', T('planHeadLine'))
    span_re(doc, 'Valuation Report of Residential Flats', r'Residential Flats .*', 'aptTitle')
    span(doc, 'UN DIVIDED SHARE', '89.37', 'udsSqyd')
    span(doc, 'RESIDENCY” (Residential', 'PGR  RESIDENCY', 'aptNameUpper')
    span(doc, 'Valuation Rs', '1,19,69,000', 'fmv')
    span_re(doc, '(RUPEES ONE CRORE', r'(?<=\(RUPEES ).*(?= ONLY)', 'fmvWordsCoreUpper')
    span(doc, 'Realizable Value: Rs', '1,13,70,000', 'realizable')
    span_re(doc, 'Pursuant to the request', r'(?<=The Manager, ).*?(?= The property)', 'bankBranchLine')
    span_re(doc, 'Pursuant to the request', r'(?<=The property is ).*?(?=Which is)', 'aptLocationLine')
    whole(doc, 'Smt  P . Prasanthi, W/o Sri R . Sambasiva Reddy .', T('applicantLine2'))
    span(doc, 'was inspected on', '18-09-2026', 'inspectionDate')
    whole(doc, ':  1381/2008   Dt', T('deedXerox1'))
    whole(doc, ':  4743/2022   Dt', T('deedXerox2'))
    whole(doc, 'Xerox Copy Of Plan Approval', T('planXeroxLine'))
    span(doc, 'fair market value of the property', '1,19,69,000', 'fmv')
    span(doc, 'comparable sale value', '1,13,70,000', 'realizable')
    span(doc, 'Forced sale value of the property', '1,07,72,000', 'distress')
    span_re(doc, '(Rupees : One Crore', r'(?<=\(Rupees : ).*(?=  only)', 'fmvWordsCore')
    span(doc, 'I have inspected the property on', '18-09-2026', 'inspectionDate')
    span(doc, 'I have inspected the property on', 'Sri T . Ramalingaiah', 'bankOfficial')
    span_re(doc, 'Branch   :    RAJIV', r'RAJIV PARK  BRANCH, Kadapa, Y\.S\.R\. \(Dt\)\.', 'bankBranchLine2')
    span_re(doc, 'Customer :', r'Smt  P \. Prasanthi.*', 'applicantLine2')

    a, b, c, d, e = t[0], t[1], t[2], t[3], t[4]
    cell(a, 0, 3, '=Belongs to:-', 'owner1NameLine', 'owner1RelLine', 'owner1Addr')
    cell(a, 1, 3, 'deedLine1', 'deedLine2', 'roLine', '=Verified', 'surveyLineC', 'udsSqydLine', 'udsSqydLine')
    cell(a, 2, 3, 'landType')
    cell(a, 3, 3, 'flatLocationLine')
    for r, side in ((6, 'East'), (7, 'West'), (8, 'North'), (9, 'South')):
        cell(a, r, 2, f'bdDeed{side}')
        cell(a, r, 3, f'bdActual{side}')
    cell(a, 10, 1, '=Flat  Boundaries   (Flat No : ' + T('flat1No') + ')')
    cell(a, 10, 4, 'fb2Head')
    for r, side in ((11, 'East'), (12, 'West'), (13, 'North'), (14, 'South')):
        cell(a, r, 2, f'fb1{side}')
        cell(a, r, 4, f'fb2{side}')
    for r, side in ((7, 'East'), (8, 'West'), (9, 'North'), (10, 'South')):
        cell(b, r, 2, f'dimDeed{side}')
        cell(b, r, 8, f'dimActual{side}')
    cell(b, 11, 1, 'siteExtentLine')
    cell(b, 11, 8, 'siteExtentLine')
    for r in (13, 14, 15, 16):
        cell(b, r, 3, '= ', 'udsSqydLine')
        cell(b, r, 8, '= ', 'udsSqydLine')
    cell(b, 17, 8, 'udsSqydLine')
    for r, key in ((19, 'firstPartyLines'), (20, 'secondPartyLines'), (21, 'udsSqydLine'), (22, 'registeredFor'),
                   (23, 'registrationDates')):
        cell(b, r, 5, key)
    cell(b, 31, 6, 'surfaceComm')
    cell(b, 34, 6, '=Yes, ', 'assessmentLine', 'taxAmountLine')
    cell(b, 35, 6, 'inspectionDate', '= ', '=Building', '=Not Applicable')
    cell(b, 38, 6, 'guidelineRateLine', '= ')
    cell(b, 39, 6, 'marketRateLine', 'adoptedRateLine')
    cell(b, 40, 7, 'landCalc', 'landCalc2', 'landSayLine', 'landMarketRs', 'landRealizableRs', 'landDistressRs',
         'landMarketRs')
    drop_rows(b, *range(0, 5))               # the sample's flats 303 / 304

    cell(c, 0, 3, 'owner1NameLine', 'owner1RelLine', 'owner1Addr')
    cell(c, 1, 3, 'deedLine1', 'deedLine2')
    cell(c, 2, 3, '=Verified', 'surveyLineC')
    cell(c, 3, 3, 'udsSqydLine')
    cell(c, 4, 3, 'udsSqydLine')
    cell(c, 5, 3, 'aptLocationLine2')
    for r, side in ((8, 'East'), (9, 'West'), (10, 'North'), (11, 'South')):
        cell(c, r, 2, f'bdDeed{side}')
        cell(c, r, 3, f'bdActual{side}')
    cell(c, 12, 1, '=Flat  Boundaries   Flat No : ' + T('flat1No'))
    cell(c, 12, 4, 'fb2HeadB')
    for r, side in ((13, 'East'), (14, 'West'), (15, 'North'), (16, 'South')):
        cell(c, r, 2, f'fb1{side}')
        cell(c, r, 4, f'fb2{side}')

    for r, side in ((7, 'East'), (8, 'West'), (9, 'North'), (10, 'South')):
        cell(d, r, 3, f'dimDeed{side}')
        cell(d, r, 9, f'dimActual{side}')
    cell(d, 11, 3, 'siteExtentLine')
    cell(d, 11, 9, 'siteExtentLine')
    for r in (13, 14, 15, 16):
        cell(d, r, 3, '= ', 'udsSqydLine', '= ')
        cell(d, r, 5, '= ', 'udsSqydLine')
    cell(d, 17, 5, 'udsSqydLine')
    for r, key in ((19, 'firstPartyLines'), (20, 'secondPartyLines'), (21, 'udsSqydLine'), (22, 'registeredFor'),
                   (23, 'registrationDates')):
        cell(d, r, 7, key)
    cell(d, 27, 7, 'tenancy', '= ', '= ')
    cell(d, 31, 6, 'planBuilt', 'planNoLine', 'planDateLine', '= ')
    for r, key in ((32, 'deviations'), (33, 'ageLine'), (34, 'lifeLine'), (37, 'taxAmountLine'), (39, 'buildingUse'),
                   (40, 'occupancy'), (41, 'rentLine')):
        cell(d, r, 6, key)
    cell(d, 36, 6, '=Yes, ', 'assessmentLine')
    drop_rows(d, *range(0, 5))               # flats 303 / 304 again (building summary)

    for r, key in ((0, 'udsSqydLine'), (1, 'builtUpLine'), (2, 'yearOfConstruction'), (3, 'structureType'),
                   (4, 'roofType'), (5, 'floorName'), (7, 'replacementTotal'), (9, 'buildingValue'),
                   (10, 'buildingDistress'), (16, 'railwayStation'), (21, 'fmvRs'), (22, 'realizableRs'),
                   (23, 'distressRs'), (24, 'fmvRs')):
        cell(e, r, 2, key)
    cell(e, 6, 2, 'replCalc', 'replCalc2')
    cell(e, 8, 1, '=Less:- Depreciation ' + T('depPctNum') + '%   (Rs. in lacs)')
    cell(e, 8, 2, 'depLine')
    cell(e, 20, 2, 'totalCalc', 'totalSay')

    signature_before(doc, 'Signature (with seal)')
    replace_all_body(doc, '19-09-2026', 'reportDate')
    places(doc)
    location_map(doc, 'Location Map', 'Photo’s', close_up=False)
    mark_images(doc, 'Photo’s', 'photo', stop_text='Google Map')
    mark_images(doc, 'Google Map', 'map')


FORMATS = {'open_site': open_site, 'house': house, 'apartment': apartment}

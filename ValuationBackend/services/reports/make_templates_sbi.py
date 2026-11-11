"""
State Bank of India: fill-in templates from the bank's own sample reports (sbi_source/*.docx).

Run:  python3 make_templates.py sbi [apartment|house]
Only the sample values are swapped for {{tags}}; the letterhead, tables, fonts, colours and
fixed wording stay exactly as the bank's file. (Open site and agriculture samples are old .doc
files — they are added once the bank's files are re-saved as .docx.)
"""
from make_templates import (T, span, span_re, whole, cell, mark_images, replace_all_body)
from make_templates_bob import places
from make_templates_union import location_map
from make_templates_karnataka import swap_all, signature_before


# --------------------------------------------------------------------------- APARTMENT
def apartment(doc):
    t = doc.tables
    replace_all_body(doc, '2505083', 'fileNo')
    span(doc, 'District   :', 'Y S R', 'district')
    span(doc, 'Branch    :', 'RACPC - KADAPA', 'bankBranchUpper')
    span(doc, 'MUKUNDA NILAYAM ”', 'MUKUNDA NILAYAM', 'aptNameUpper')
    whole(doc, 'Stilt + Ground Floor + 4 Upper Floors', T('floorsDesc'))
    span(doc, 'Belongs to :-', '“ M/S SRI LAKSHMI VENKATESWARA CONSTRUCTIONS ”', 'firmQuoted')
    whole(doc, 'Managing Partner’s:-', T('partnersLabel'))
    whole(doc, 'Venkata Shivaji', T('ownerLine1'))
    whole(doc, 'Vasantham Heights', T('owner1Addr'))
    whole(doc, 'K. Swathi', T('ownerLine2'))
    whole(doc, 'Splashing Meadows', T('owner2Addr'))
    whole(doc, 'Hyderabad, Telangana (Dt).', T('owner2Addr2'))
    whole(doc, 'Applicant :-', T('applicantLabel'))
    span(doc, 'Deed No', '7151/2019', 'deedNo')
    span(doc, 'Deed No', '53.92', 'udsSqyd')
    span(doc, 'Deed No', '1645.6', 'parentSqyd')
    span(doc, 'Survey No  :', '58/354-29', 'doorNo')
    span(doc, 'Survey No  :', '32/2B', 'surveyNo')
    span(doc, 'Flat No       :', '504', 'flatNo')
    span(doc, 'Flat No       :', 'Fifth Floor', 'floorLine')
    span(doc, 'PLAN APPROVED UNDER', '1013/0438/B/KAD/AP/2023', 'planNo')
    span(doc, 'PLAN APPROVED UNDER', '06-06-2023', 'planDate')
    span_re(doc, 'Valuation Report of', r'Residential Flat In “.*', 'aptTitle')
    span(doc, 'UN DIVIDED SHARE', '53.92', 'udsSqyd')
    span(doc, 'UN DIVIDED SHARE', '1645.6', 'parentSqyd')
    span(doc, 'Valuation   :', '52,68,000', 'fmv')
    span(doc, '(RUPEES :', 'FIFTY TWO  LAKHS  SIXTY EIGHT  THOUSANDS', 'fmvWordsKbl')
    span_re(doc, 'Kadapa Municipal Corporation, Y.S.R Dist', r'Kadapa Municipal Corporation, Y\.S\.R Dist', 'localBodyLine')
    span(doc, 'Name & Address of Branch', 'State Bank of India, RACPC, Kadapa', 'bankBranchLine')
    span(doc, 'Name of Customer', 'Sri Singam. Manoj Babu,', 'customerName')
    span(doc, 'for which valuation report is sought', 'S/o. Sri. Sudharsan Babu.', 'customerRel')
    span_re(doc, 'Justification:-', r'(?<=very near to ).*?(?=, )', 'nearBy')

    cell(t[0], 0, 0, 'customerName', 'customerRel')
    cell(t[0], 0, 1, 'customerAddr')
    b = t[1]
    cell(b, 1, 2, 'customerName', 'customerRel')
    cell(b, 4, 3, 'aptAddress')
    cell(b, 5, 3, 'nearLine')
    cell(b, 6, 3, 'nearLine')
    cell(b, 7, 3, 'latLine')
    cell(b, 8, 3, 'lngLine')
    cell(b, 9, 3, '=Deed no :', 'deedNo')
    for r in (11, 12):
        cell(b, r, 6, '=B.A. NO:- ' + T('planNo') + ',  ', '=Dt : ' + T('planDate'))
    c = t[2]
    for r, side in ((3, 'East'), (4, 'West'), (5, 'North'), (6, 'South')):
        cell(c, r, 6, f'bdDeed{side}')
        cell(c, r, 22, f'bdActual{side}')
    for r, side in ((9, 'East'), (10, 'West'), (11, 'North'), (12, 'South')):
        cell(c, r, 6, f'dimDeed{side}')
        cell(c, r, 22, f'dimActual{side}')
    cell(c, 13, 6, 'parentLine')
    cell(c, 13, 22, 'parentLine')
    cell(c, 15, 3, '=Boundaries ( As Flat = ' + T('flatNo') + ', ' + T('floorShortUpper') + ' Floor)')
    for r, side in ((16, 'East'), (17, 'West'), (18, 'North'), (19, 'South')):
        cell(c, r, 6, f'fb{side}')
    cell(c, 17, 22, 'udsOutOf')
    cell(c, 20, 22, 'udsLine')
    for r, key in ((23, 'floorsShort'), (24, 'floorLine'), (25, 'yearOfConstruction'), (26, 'ageLine'),
                   (27, 'remainingLifeLine'), (28, 'structure'), (29, 'specFlooring')):
        cell(c, r, 15, key)
    cell(c, 31, 7, '=Owned/Rented', 'rentalLine')
    cell(c, 33, 8, 'stageLine')
    cell(c, 37, 9, 'udsLine')
    cell(c, 38, 9, '= Actual ', 'plinthLine')
    cell(c, 38, 20, '=Carpet Area', 'carpetLine')
    cell(c, 39, 9, 'udsOutOf')
    cell(c, 42, 2, '=Mention the value as per Government Approved Rates also.',
         '=In case of variation of 20% or more in the valuation proposed by the valuer and the Guideline value provided in the State Govt. notification or Income Tax Gazette justification on variation has to be given.',
         '=Summary of Valuation', 'guidelineLine', 'landCalcLine')
    cell(c, 43, 2, 'buildingCalcLine', 'deprCalcLine', '= ')
    cell(c, 43, 24, 'buildingValueLine', 'deprValueLine', 'netBuildingLine')
    cell(c, 44, 24, 'siteValueLine', 'netBuildingLine2')
    cell(c, 45, 24, 'totalLine', 'sayLine')
    cell(c, 46, 2, '= ', 'fmvLine', 'realizableLine', 'distressLine')
    cell(c, 48, 13, '=The property was inspected by the undersigned on ', 'inspectionDate',
         '=The undersigned does not have any direct/indirect interest in the above property. NO',
         '=The information furnished herein is true and correct to the best of our knowledge.',
         '=I have submitted Valuation report directly to the Bank. YES')
    cell(c, 49, 25, '= ', '= ', '= ', '=Date of Valuation : ' + T('reportDate'))
    g = t[3]
    cell(g, 1, 2, 'declBackground', 'declBuilding')
    cell(g, 2, 2, '=For collateral security. Manager, ', 'declPurposeLine')
    cell(g, 5, 2, 'declDates1', 'declDates2', 'declDates3')

    span(doc, 'personally inspected', '13-03-2025', 'inspectionDate')
    span(doc, 'valuation report dated', '14-03-2025', 'reportDate')
    replace_all_body(doc, '21-05-2026', 'reportDate')
    places(doc)
    location_map(doc, 'LOCATION – MAP', 'Photos', close_up=False)
    mark_images(doc, 'Photos', 'photo', stop_text='Google Map')
    mark_images(doc, 'Google Map', 'map')


# --------------------------------------------------------------------------- HOUSE
def house(doc):
    from make_templates_pnb import drop_rows
    t = doc.tables
    replace_all_body(doc, '2605071', 'fileNo')
    span(doc, 'District   :', 'Y S R', 'district')
    span(doc, 'Branch :', 'RACPC BRANCH - KADAPA', 'bankBranchUpper')
    whole(doc, 'Smt. M. Sujatha, W/o', T('ownerLine1'))
    span_re(doc, 'Bhagya Nagar Colony, Kadapa City', r'DoorNo :.*', 'owner1Addr')
    span(doc, 'Deed No  :', '2747/2012', 'deedNo')
    span(doc, 'Deed No  :', '4.70', 'netExtentCents')
    span(doc, 'Survey No’s   :', '42/337-7-2-2', 'doorNo')
    span(doc, 'Survey No’s   :', '740/20, 740/21', 'surveyNo')
    span(doc, 'PLAN APROVED UNDER', '1013/0251/B/KAD/cch/2022', 'planNo')
    span(doc, 'PLAN APROVED UNDER', '12-04-2022', 'planDate')
    span_re(doc, 'Valuation Report Of', r'Residential Building \(Stilt\+GF\+FF\+SF\), .*', 'houseTitle')
    whole(doc, 'Old Valuation Report Not Submitted', T('oldReportNote'))
    span(doc, 'Valuation   :', '2,02,50,000', 'fmv')
    span(doc, '(RUPEES', 'TWO CRORE TWO LAKHS FIFTY THOUSAND', 'fmvWordsCoreUpper')
    whole(doc, 'Kadapa Municipal Corporation, Y.S.R(Dt).', T('localBodyLine'))

    a = t[0]
    cell(a, 0, 5, 'bankBranchLine')
    for r in (1, 3):
        cell(a, r, 5, '=Belongs To :', 'owner1NameLine', 'owner1RelLine', 'owner1Addr', '= ')
    cell(a, 6, 5, 'locationLine')
    cell(a, 7, 7, 'gpsDms', 'gpsDecimal')
    cell(a, 9, 5, 'nearLine')
    cell(a, 11, 5, 'accessLine')
    for r in (14, 15):
        cell(a, r, 4, '=B.A. No : ' + T('planNo') + ', ', '=Dt :- ' + T('planDate') + '.')
    b = t[1]
    cell(b, 1, 4, '=Deed No : ' + T('deedNo') + ', Date : ' + T('deedDate') + '.')
    cell(b, 3, 4, 'taxName', 'taxLine')
    c = t[2]
    for r, side in ((3, 'North'), (4, 'South'), (5, 'East'), (6, 'West')):
        cell(c, r, 2, f'bdDeed{side}')
        cell(c, r, 3, f'bdActual{side}')
    for r, key in ((14, 'floorsShort'), (15, 'floorsShort'), (16, 'yearAgeLine'), (17, 'residualLine'), (18, 'structure')):
        cell(c, r, 3, key)
    e = t[4]
    cell(e, 3, 2, 'item1Head')
    cell(e, 3, 3, 'item2Head')
    for r, side in ((4, 'North'), (5, 'South'), (6, 'East'), (7, 'West')):
        cell(e, r, 2, f'dimDeed{side}')
        cell(e, r, 3, f'dim2{side}')
    cell(e, 8, 2, 'item1Extent')
    cell(e, 8, 3, 'item2Extent')
    cell(e, 9, 2, 'totalItemsLine')
    g5 = t[5]
    for r in (0, 1, 2, 3):
        cell(g5, r, 2, 'extentTotalLine')
    cell(g5, 4, 2, 'roadAffected')
    cell(g5, 5, 2, 'netLineA', 'netLineB')
    g6 = t[6]
    cell(g6, 0, 3, 'netLineA', 'netLineB')
    cell(g6, 2, 1, '=As Per Plan:', 'plinthLines')
    cell(g6, 2, 2, '=As Per Visit:', 'plinthLines')
    cell(g6, 3, 1, '=C) Carpet area :', 'carpetLines')
    cell(g6, 3, 2, '= C) Carpet area :', 'carpetLines')
    cell(g6, 4, 1, '=d) Saleable Area : ' + T('netExtentCents') + ' Cents')
    cell(g6, 9, 2, 'netLineA', 'netLineB')
    cell(g6, 10, 2, 'marketRateLine')
    cell(g6, 11, 2, 'landCalc')
    cell(g6, 12, 2, 'landValueLine')
    cell(g6, 14, 2, 'guidelineRateLine')
    cell(g6, 15, 2, 'guidelineValueLine')
    h = t[7]
    specs = ['foundation', 'basement', 'superstructure', 'joinery', 'rccWorks', 'plastering', 'flooring',
             'specialFinish', 'roofing', 'drainage']
    for i, key in enumerate(specs):
        cell(h, 1 + i, 3, f'specGF_{key}')
    fl = t[8]
    drop_rows(fl, 2, 3, 4)
    for ci, key in ((0, 'fl.sno'), (1, 'fl.label'), (3, 'fl.height'), (4, 'fl.age'), (5, 'fl.rate'),
                    (6, 'fl.replacement'), (8, 'fl.net')):
        cell(fl, 1, ci, key)
    cell(fl, 1, 2, 'fl.plinthNum', '=Sqft')
    cell(fl, 1, 7, 'fl.depPct', 'fl.depAmount')
    cell(fl, 2, 8, 'buildingTotalLine')
    for ti, keys in ((9, ['ex_portico', 'ex_frontDoor', 'ex_sitOut', 'ex_ohTank', 'ex_gates', 'partC']),
                     (10, ['am_wardrobes', 'am_tvUnit', 'am_sinks', 'am_marble', 'am_interior', 'am_elevation',
                           'am_paneling', 'am_aluminium', 'am_handRails', 'am_falseCeiling', 'partD']),
                     (11, ['mi_toilet', 'mi_lumber', 'mi_sump', 'mi_trees', 'partE']),
                     (12, ['sv_water', 'sv_drainage', 'sv_compoundWall', 'sv_cbDeposits', 'sv_sump', 'partF'])):
        for r, key in enumerate(keys):
            cell(t[ti], r, 3, key)
    ab = t[13]
    for r, key in ((1, 'absA'), (2, 'absB'), (3, 'absC'), (4, 'absD'), (5, 'absE'), (6, 'absF'), (7, 'absTotalSay'),
                   (8, 'fmvLine'), (9, 'realizableLine'), (10, 'distressLine')):
        cell(ab, r, 3, key)
    cell(t[14], 14, 4, '=Date of Valuation: ', 'reportDate')
    g = t[16]
    cell(g, 1, 2, 'declBackground')
    cell(g, 2, 2, '=For collateral security. Manager,', 'declBranchLine', 'districtDottedDt')
    cell(g, 5, 2, 'declDates1', 'declDates2', 'declDates3')

    # Invoice page (a text box at the end)
    swap_all(doc, '13-05-2026', T('reportDate'))
    swap_all(doc, '     RACPC BRANCH,', '     ' + T('bankBranchUpper') + ',')
    swap_all(doc, 'Smt. M. Sujatha, W/o. M. Venkata Subbaiah.', T('ownerLine1'))
    swap_all(doc, 'Residential Building (Stilt+GF+FF+SF), In Site Survey No’s : 740/20, 740/21, Door No : 42/337-7-2-2, '
                  'Ward No : 42, In Bhagya Nagar Colony, Near Gurukul Vidyapeeth EM High School, Chinnachowk Village Field '
                  'At Kadapa Municipal Corporation Of  Y.S.R. (Dt).', T('houseTitle'))
    swap_all(doc, 'Rs 2,02,50,000/-', 'Rs ' + T('fmv') + '/-')
    swap_all(doc, 'Rs 4,000/-', 'Rs ' + T('fee') + '/-')
    swap_all(doc, 'Rupees  Four Thousand only', T('feeWords'))
    whole(doc, '14°28\'04.4"N', T('gpsDms'))
    whole(doc, '14.467879, 78.836991', T('gpsDecimal'))
    signature_before(doc, 'Signature  of  the Valuer')
    replace_all_body(doc, '20-05-2026', 'reportDate')
    swap_all(doc, '20-05-2026', T('inspectionDate'))
    places(doc)
    location_map(doc, 'LOCATION MAP', 'PHOTO’S', close_up=False)
    mark_images(doc, 'PHOTO’S', 'photo', stop_text='GOOGLE MAP')
    mark_images(doc, 'GOOGLE MAP', 'map')


FORMATS = {'apartment': apartment, 'house': house}

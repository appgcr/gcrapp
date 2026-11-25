"""
State Bank of India: fill-in templates from the bank's own sample reports (sbi_source/*.docx).

Run:  python3 make_templates.py sbi [apartment|house|agriculture|open_site]
Only the sample values are swapped for {{tags}}; the letterhead, tables, fonts, colours and
fixed wording stay exactly as the bank's file. 
"""
from make_templates import (T, span, span_re, whole, cell, mark_images, replace_all_body)
from docx_tools import find_para, replace_span
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
    # the sample's engineer initials and its "personally inspected on" date (same as its report date)
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
    # the sample's engineer initials, and its "personally inspected on" date (it matched its report date)
    p = find_para(doc, 'Punjab National Bank.')
    p is not None and replace_span(p, 'SMN & AR', T('engineerInitials'))
    p = find_para(doc, 'personally inspected')
    p is not None and replace_span(p, T('reportDate'), T('inspectionDate'))


# --------------------------------------------------------------------------- AGRICULTURE LAND
def agriculture(doc):
    """SBI's newer one-page-table format for open agriculture land (acres x rate per acre)."""
    t = doc.tables
    replace_all_body(doc, '2610102', 'fileNo')
    span(doc, 'District   :', 'YSR', 'districtShort')
    span_re(doc, 'Branch : SME', r'SME BRANCH, KADAPA\.', 'bankBranchUpperDot')
    whole(doc, 'Venkata Sailaja, W/o', T('ownerLine1'))
    whole(doc, '8/260-Up Stair', T('owner1Addr'))
    span(doc, '2009/2026', '2009/2026', 'deedNo')
    span(doc, 'Ac 4.95 Cents', '4.95', 'totalAc')
    span(doc, '470-1-P2', '470-1-P2', 'surveyNo')
    span_re(doc, 'Valuation Report of Agriculture', r'Agriculture Land, .*', 'agTitle')
    span(doc, 'Valuation  : Rs', '49,50,000', 'fmv')
    span_re(doc, '(RUPEES', r'(?<=\(RUPEES ).*(?= ONLY)', 'fmvWordsCoreUpper')
    whole(doc, 'Nallaballe Village & GP', T('villageMandalLine'))
    span_re(doc, 'Name & Address of Branch', r'State Bank of India, .*', 'branchAddrLine')
    span_re(doc, 'Name of Customer', r'(?<=:  ).*', 'custNameLine')
    span_re(doc, '(for which valuation report is sought)', r'W/o\..*', 'custRelLine')
    span(doc, 'personally inspected', '06-11-2026', 'inspectionDate')

    a, b, c, d3, e = t[0], t[1], t[2], t[3], t[5]
    cell(a, 1, 4, '=Belongs To:', 'ownerLine1', 'owner1Addr')
    cell(a, 4, 5, 'agLocation')
    cell(a, 5, 5, 'nearByLine')
    cell(a, 6, 5, 'gpsDms', 'gpsDecimal', '= ')
    for r, side in ((15, 'East'), (16, 'West'), (17, 'North'), (18, 'South')):
        cell(a, r, 3, f'bdDeed{side}')
        cell(a, r, 7, f'bdActual{side}')
    for r in (20, 21, 22, 23):
        cell(a, r, 4, '= ', '= ', '=       ' + T('extentAcLine'))
        cell(a, r, 7, '= ', 'extentAcLine')
    cell(a, 24, 4, 'extentAcLine')
    cell(a, 24, 7, 'extentAcLine')
    cell(b, 0, 17, 'approvedLandUse')
    cell(b, 0, 20, 'propertyKind')
    cell(b, 3, 11, 'agLocation')
    cell(b, 9, 11, '=The Agriculture Land  ' + T('agLocation'))
    cell(b, 13, 5, 'constructionStage')
    cell(b, 17, 6, 'extentAcLine')
    cell(b, 20, 6, 'extentAcLine')
    cell(c, 0, 5, 'guidelineLine')
    cell(c, 1, 1, '=Land:   ' + T('extentAcLine') + ' X  ' + T('rateAcre') + '/- Acer')
    cell(c, 1, 5, '== Rs ' + T('landValue') + '/-')
    cell(c, 2, 5, '== Rs ' + T('fmv') + '/-')
    cell(c, 3, 1, '=Fair Market value               =  Rs ' + T('fmv') + '/-',
         '=Realizable value                  =  Rs ' + T('realizable') + '/-',
         '=Forced/Distress Sale value =  Rs ' + T('distress') + '/-')
    cell(c, 5, 4, '=The property was inspected by the undersigned on ', 'inspectionDate',
         '=The undersigned does not have any direct/indirect interest in the above property. : NO',
         '=The information furnished herein is true and correct to the best of our knowledge.',
         '=I have submitted Valuation report directly to the Bank. : YES')
    cell(d3, 0, 3, '= ', '= ', '= ', '= ', '=Date of Valuation :   ' + T('reportDate'))
    cell(e, 1, 2, 'declBackground')
    cell(e, 2, 2, 'declPurpose')
    cell(e, 5, 2, 'declDates1', 'declDates2', 'declDates3')

    replace_all_body(doc, '06-11-2026', 'reportDate')
    places(doc)
    mark_images(doc, 'PHOTO’S', 'photo', stop_text='GOOGLE MAP')
    mark_images(doc, 'GOOGLE MAP', 'map')
    whole(doc, '14°39', T('gpsDms'))
    whole(doc, '14.655472, 78.398222', T('gpsDecimal'))


# --------------------------------------------------------------------------- OPEN SITE
def open_site(doc):
    """SBI's newer Annexure-XI 'Format-A' for a vacant site (land per cent; Parts C–F left blank)."""
    t = doc.tables
    replace_all_body(doc, '2611131', 'fileNo')
    span(doc, 'District   :', 'Y.S.R', 'districtDotted')
    span(doc, 'Branch   :    SME', 'SME BRANCH', 'bankBranchUpper')
    whole(doc, 'Sathya Narayana  S/o', T('ownerLine1'))
    whole(doc, 'Door No: 6/122', T('owner1Addr'))
    whole(doc, 'Cell No : 9849840448', T('ownerPhoneLine'))
    span(doc, '1362/2020', '1362/2020', 'deedNo')
    span(doc, 'Deed No', '11.00', 'extentCents')
    whole(doc, 'Demolished D.No', T('doorSurveyFront'))
    span_re(doc, 'Valuation Report of Residential Vacant Site', r'Residential Vacant Site .*', 'siteTitle')
    whole(doc, 'Note : Even Though', T('siteNote'))
    span(doc, 'Valuation : Rs', '2,03,50,000', 'fmv')
    span_re(doc, '(RUPEES', r'(?<=\(RUPEES ).*(?= ONLY)', 'fmvWordsCoreUpper')
    whole(doc, 'Kadapa Municipal Corporation of Y.S.R (Dt).', T('localBodyLine'))
    span(doc, 'personally inspected', '25-11-2026', 'inspectionDate')

    a, b, c, s9, s10, s11, s12 = t[0], t[1], t[2], t[9], t[10], t[11], t[12]
    cell(a, 0, 7, '=SBI  ' + T('bankBranchName') + ',')
    cell(a, 1, 7, 'owner1NameLine', 'owner1RelLine')
    cell(a, 3, 7, '=Belongs To :-  ', 'owner1NameLine', 'owner1RelLine', 'owner1Addr', 'ownerPhoneLine')
    cell(a, 6, 7, 'locationLine')
    cell(a, 7, 9, 'latLine', '= ', 'lngLine', '= ')   # one merged cell beside Latitude / Longitude
    cell(a, 9, 7, 'nearByLine')
    cell(a, 11, 7, 'accessLine')
    cell(a, 17, 8, '=Deed No: ' + T('deedNo') + ', Date: ' + T('deedDate') + '.')
    for r, side in ((3, 'East'), (4, 'West'), (5, 'North'), (6, 'South')):
        cell(b, r, 2, f'bdDeed{side}')
        cell(b, r, 3, f'bdActual{side}')
    for r, side in ((4, 'East'), (5, 'West'), (6, 'North'), (7, 'South')):
        cell(c, r, 2, f'dimDeed{side}')
        cell(c, r, 8, f'dimActual{side}')
    cell(c, 8, 2, 'extentDeedYdC')
    for r, key in ((9, 'extentPlanYdC'), (10, 'roadAffected'), (11, 'netExtentYdC'), (12, 'consYdC')):
        cell(c, r, 6, key)
    cell(c, 16, 1, '=d)Saleable Area :  ' + T('consCentsLine'))
    for r, key in ((21, 'consYdC'), (22, 'marketRateLine'), (23, 'adoptedRateLine'), (24, 'landValueRs')):
        cell(c, r, 3, key)
    cell(c, 27, 4, 'guidelineLine')
    for r, key in ((1, 'landValueRs'), (7, 'landValueRs'), (8, 'fmvRs'), (9, 'realizableRs'), (10, 'distressRs')):
        cell(s9, r, 3, key)
    cell(s10, 8, 1, '=i) The property was inspected by the undersigned on  ' + T('inspectionDate'))
    cell(s10, 14, 4, '= ', '= ', '= ', '= ', '= ', '=      Date of Valuation: ', '=     ' + T('reportDate'), '= ')
    cell(s11, 7, 2, '=Note:-I my Self Verified the Property values in Portals like Magic Bricks.com, 99 acres.com, '
                    'Housing Com etc. and found that ' + T('placeTown') + ' is not appearing in the respective above sites '
                    '& Hence we have considering the Local Market Values compared to S.R.O ' + T('sroPlace') + '   ')
    cell(s12, 1, 2, 'declBackground')
    cell(s12, 2, 2, 'declPurpose')
    cell(s12, 5, 2, 'declDates1', 'declDates2', 'declDates3')

    replace_all_body(doc, '25-11-2026', 'reportDate')
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    for p in doc.paragraphs[:20]:            # 'Date : …' was pushed right with ~120 spaces; it wraps on narrow fonts
        if p.text.strip().startswith('Date :') and p.text.startswith('   '):
            for r in p.runs:                 # drop the leading spaces, run by run, up to the first text
                text = r.text.lstrip()
                r.text = text
                if text:
                    break
            p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            break
    places(doc)
    location_map(doc, 'LOCATION MAP', 'PHOTO’S', close_up=False)
    mark_images(doc, 'PHOTO’S', 'photo', stop_text='Sri Gouru. Neelakanta Reddy')


FORMATS = {'apartment': apartment, 'house': house, 'agriculture': agriculture, 'open_site': open_site}

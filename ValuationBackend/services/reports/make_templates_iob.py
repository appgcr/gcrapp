"""
Indian Overseas Bank: fill-in templates from the bank's own sample reports (iob_source/*.docx).

Run:  python3 make_templates.py iob [house|apartment|open_site]
Only the sample values are swapped for {{tags}}; the letterhead, tables, fonts, colours and
fixed wording stay exactly as the bank's file.
"""
from make_templates import (T, span, span_re, whole, cell, mark_images, replace_all_body)
from make_templates_bob import places, tb_span
from make_templates_union import location_map
from make_templates_pnb import drop_rows

CHARS = ['locality', 'surroundings', 'flooding', 'civicAmenities', 'levelOfLand', 'landShape', 'landUse',
         'usageRestriction', 'layoutApproved', 'cornerPlot', 'roadFacilities', 'roadType', 'roadWidth',
         'landLocked', 'water', 'sewerage', 'power']


def values_page(doc, fmv, fmv_words, real, real_words, dist, dist_words):
    """'1) Fair Market Value … Rs.x/- (Rupees … only).' lines at the end of the report."""
    import re
    span_re(doc, fmv_words, r'Rs\. ?' + re.escape(fmv) + r'/- ?\(Rupees ' + re.escape(fmv_words) + r' [Oo]nly\)',
            '=Rs.' + T('fmv') + '/- (' + T('fmvWords') + ')')
    span_re(doc, real_words, r'Rs\. ?' + re.escape(real) + r'/- ?\(Rupees ' + re.escape(real_words) + r' [Oo]nly\)',
            '=Rs. ' + T('realizable') + '/- (' + T('realizableWords') + ')')
    span_re(doc, dist_words, r'Rs\. ?' + re.escape(dist) + r'/- ?\(Rupees ' + re.escape(dist_words) + r' [Oo]nly\)',
            '=Rs.' + T('distress') + '/- (' + T('distressWords') + ')')


def justification(doc, owner_text, net_sqyd=None):
    """Covering letter to the Branch Head: owner, property address and the plan extent."""
    span(doc, 'Justification/ Clarification', owner_text, 'ownerLine1')
    span_re(doc, 'Residential Property In', r'(?<=Residential Property )In .*', 'locationLine')
    if net_sqyd:
        span(doc, 'Iam Considering Site Area', net_sqyd, 'netSqyd')


# --------------------------------------------------------------------------- HOUSE
def house(doc):
    t = doc.tables
    replace_all_body(doc, '2511141', 'fileNo')
    span(doc, 'District   :', 'Y.S.R.', 'districtDotted')
    span(doc, 'Branch   :', 'MAIN BRANCH – KADAPA', 'bankBranchUpper')
    span_re(doc, 'Nara Subba Reddy.', r'Sri\. U\. Subba.*', 'ownerLine1')
    span_re(doc, 'Alamkhanpalle, Kadapa City', r'Door No :.*', 'owner1Addr')
    span(doc, 'Deed No    :', '3410/2014', 'deedNo')
    span(doc, 'Deed No    :', '3.66', 'netExtentCents')
    span(doc, 'Survey No   :', '70/233-1', 'doorNo')
    span(doc, 'Survey No   :', '482', 'surveyNo')
    span(doc, 'Plan Approved Under', '696/G1/2015', 'planNo')
    span(doc, 'Plan Approved Under', '02-03-2016', 'planDate')
    span_re(doc, 'Valuation Report of', r'Residential Building \(GF\+FF\), .*', 'houseTitle')
    span(doc, 'Valuation: Rs', '90,25,000', 'fmv')
    span(doc, '(RUPEES', 'NINETY LAKHS TWENTY FIVE THOUSAND', 'fmvWordsCoreUpper')
    span_re(doc, 'Kadapa Municipal Corporation Of Y.S.R. (Dt).', r'Kadapa.*', 'localBodyLine')
    values_page(doc, '90,25,000', 'Ninety Lakhs Twenty Five Thousand', '81,50,000', 'Eighty One Lakhs Fifty Thousand',
                '72,20,000', 'Seventy Two Lakhs Twenty Thousand')

    a = t[0]
    for r, key in ((1, 'purpose'), (2, 'inspectionDate'), (3, 'valuationDate'), (9, 'locationLine'),
                   (11, 'surveyLine'), (12, 'doorLine'), (13, 'villageLine'), (14, 'wardLine'), (15, 'localBodyLine2'),
                   (16, 'postalAddress'), (17, 'cityTown'), (18, 'areaResidential'), (19, 'areaCommercial'),
                   (20, 'areaIndustrial'), (22, 'areaClass'), (23, 'areaUrban')):
        cell(a, r, 9, key)
    for r, key in ((24, 'localBodyType'), (25, 'govtEnactments'), (26, 'agriConversion')):
        cell(a, r, 12, key)
    cell(a, 5, 9, '=Deed No : ' + T('deedNo') + ',   Dt : ' + T('deedDate') + '.')
    cell(a, 6, 9, '=Plan Approved Under', 'planLine')
    cell(a, 8, 9, '=Belongs To:-', 'owner1NameLine', 'owner1RelLine', 'owner2NameLine', 'owner2RelLine',
         'owner3NameLine', 'owner3RelLine', 'owner1Addr', 'ownerPhoneLine')
    for r, side in ((29, 'North'), (30, 'South'), (31, 'East'), (32, 'West')):
        cell(a, r, 8, f'bdDeed{side}')
        cell(a, r, 12, f'bdActual{side}')
    for r, side in ((35, 'North'), (36, 'South'), (37, 'East'), (38, 'West')):
        cell(a, r, 8, f'dimDeed{side}')
        cell(a, r, 12, f'dimActual{side}')
    cell(a, 39, 8, 'extentDeed')
    cell(a, 39, 12, 'extentActual')
    cell(a, 40, 3, '=Net Extent : ' + T('netExtentLine'))
    cell(a, 41, 13, 'gpsDms', 'gpsDecimal', '= ')
    whole(doc, '14°30\'01.9"N', T('gpsDms'))
    whole(doc, '14.500517, 78.793742', T('gpsDecimal'))
    cell(a, 43, 11, 'extentDeed')
    cell(a, 44, 11, 'netExtentLine')
    cell(a, 45, 11, 'occupancy')
    for i, key in enumerate(CHARS):
        cell(a, 47 + i, 11, key)
    cell(a, 65, 11, 'advantage1')
    cell(a, 66, 11, 'advantage2')
    cell(a, 67, 11, 'specialRemarks')
    cell(a, 71, 9, 'landShape')
    for r in (72, 73, 74):
        cell(a, r, 9, 'extentDeedA', 'extentDeedB')
    cell(a, 75, 9, 'netExtentLine')
    cell(a, 76, 9, 'marketRateLine')
    cell(a, 77, 9, 'guidelineRateLine')
    cell(a, 78, 9, '= ', 'adoptedRateLine')
    cell(a, 79, 9, 'landValueLine')

    b = t[1]
    for r, key in ((2, 'buildingType'), (3, 'constructionType'), (4, 'yearLine'), (5, 'ageLine'),
                   (6, 'remainingLifeLine'), (7, 'floorsLine'), (13, 'conditionExterior'), (14, 'conditionInterior'),
                   (15, 'planLine2'), (16, 'planAuthority'), (17, 'planVerified'), (18, 'planComments')):
        cell(b, r, 4, key)
    for r in (9, 11):
        cell(b, r, 2, 'plinthLines')
        cell(b, r, 4, 'carpetLines')

    c = t[2]
    specs = ['foundation', 'basement', 'superstructure', 'joinery', 'rccWorks', 'plastering', 'flooring',
             'specialFinish', 'roofing', 'drainage']
    for i, key in enumerate(specs):
        cell(c, 1 + i, 6, f'specGF_{key}')
    for r, key in ((12, 'compoundWall'), (13, 'cwHeight'), (14, 'cwLength'), (15, 'cwType'), (17, 'wiring'),
                   (18, 'fittingsClass'), (19, 'lightPoints'), (20, 'fanPoints'), (21, 'plugPoints'),
                   (22, 'electricalOther'), (24, 'waterClosets'), (25, 'washBasins'), (26, 'urinals'),
                   (27, 'bathTubs'), (28, 'waterMeter')):
        cell(c, r, 7, key)

    e = t[3]
    drop_rows(e, 2)
    cell(e, 1, 0, 'fl.sno')
    cell(e, 1, 1, 'fl.code')
    cell(e, 1, 2, 'fl.plinthNum', '=Sqft')
    cell(e, 1, 3, 'fl.height')
    cell(e, 1, 4, 'fl.ageNum', '=Years ')
    cell(e, 1, 5, 'fl.rateSqft')
    cell(e, 1, 6, '=Rs', 'fl.replacementNum')
    cell(e, 1, 7, 'fl.depPct', 'fl.depAmount')
    cell(e, 1, 8, 'fl.net')
    cell(e, 2, 8, '=  Rs   ', 'buildingTotalNum')

    for ti, keys in ((4, ['ex_portico', 'ex_frontDoor', 'ex_sitOut', 'ex_ohTank', 'ex_gates', 'partC']),
                     (5, ['am_wardrobes', 'am_glazedTiles', 'am_sinks', 'am_marble', 'am_interior', 'am_elevation',
                          'am_paneling', 'am_aluminium', 'am_handRails', 'am_falseCeiling', 'partD']),
                     (6, ['mi_toilet', 'mi_lumber', 'mi_sump', 'mi_trees', 'partE']),
                     (7, ['sv_water', 'sv_drainage', 'sv_compoundWall', 'sv_cbDeposits', 'sv_pavement', 'partF'])):
        for r, key in enumerate(keys):
            cell(t[ti], r, 3, key)
    for r, key in enumerate(['absA', 'absB', 'absC', 'absD', 'absE', 'absF', 'absTotal', 'absSayAs']):
        cell(t[8], r, 3, key)
    g = t[9]
    cell(g, 1, 2, 'declBackground')
    cell(g, 2, 2, 'declPurpose')
    cell(g, 5, 2, 'declDates1', 'declDates2', 'declDates3')

    justification(doc, 'Sri. U. Subba Rami Reddy, S/o. Sri. U. Nara Subba Reddy.', '176.97')
    span(doc, 'personally inspected', '24-11-2025', 'inspectionDate')
    replace_all_body(doc, '25-11-2025', 'reportDate')
    places(doc)
    mark_images(doc, 'PHOTO’S', 'photo', stop_text='LOCATION MAP')
    location_map(doc, 'LOCATION MAP', 'GOOGLE MAP', close_up=False)
    mark_images(doc, 'GOOGLE MAP', 'map')


# --------------------------------------------------------------------------- APARTMENT
def apartment(doc):
    t = doc.tables
    replace_all_body(doc, '2501173', 'fileNo')
    span(doc, 'District   :', 'KADAPA', 'districtUpper')
    span(doc, 'Branch  :', 'KADAPA BRANCH', 'bankBranchUpper')
    span(doc, 'SHAN TOWER', 'SHAN TOWER', 'aptNameUpper')
    span(doc, 'Upper Floors', 'Stilt+ Ground Floor + 4 Upper Floors', 'floorsDesc')
    whole(doc, 'Sri K. Obulesu, S/o', T('ownerLine1'))
    span_re(doc, 'Professors Colony', r'Door No.*', 'owner1Addr')
    whole(doc, 'Applicant  : -', T('applicantLabel'))
    span_re(doc, 'Subbarathnamma', r'Smt T\. Subbarathnamma.*', 'applicantLine')
    span_re(doc, 'Bharat Nagar', r'Door No.*', 'applicantAddr')
    span_re(doc, 'Cell No', r'80961 59470', 'ownerPhone')
    span(doc, 'GPA Deed No', 'GPA Deed No', 'deedLabel')
    span(doc, '4440/2022', '4440/2022', 'deedNo')
    span(doc, 'Out Of', '37.26', 'udsSqyd')
    span(doc, 'Out Of', '372.66', 'parentSqyd')
    span(doc, 'Flat No               :', '102', 'flatNo')
    span(doc, 'Flat No               :', 'First Floor', 'floorLine')
    span(doc, 'Flat No               :', '91/1, 752/2', 'surveyNo')
    span(doc, 'Door No             :', '42/156', 'doorNo')
    span(doc, 'Plan Approved Under', '1013/0950/B/KAD/CCH/2022', 'planNo')
    span(doc, 'Plan Approved Under', '08-07-2022', 'planDate')
    span_re(doc, 'Valuation Report of', r'Residential Flat In .*', 'aptTitle')
    span(doc, 'Valuation : Rs', '57,10,000', 'fmv')
    span(doc, '( RUPEES', 'FIFTY SEVEN LAKHS TEN THOUSAND', 'fmvWordsCoreUpper')
    span_re(doc, 'Kadapa Municipal Corporation; Y.S.R.', r'Kadapa.*', 'localBodyLine')
    span_re(doc, 'As a result of my appraisal', r'Rs\. 57,10,000/- \(Rs Fifty Seven Lakhs Ten Thousand only\)',
            '=Rs. ' + T('fmv') + '/- (Rs ' + T('fmvWordsCore') + ' only)')
    span_re(doc, 'The Realizable value', r'Rs\. 51,50,000/- \(Rupees Fifty One Lakhs Fifty Thousand only\)',
            '=Rs. ' + T('realizable') + '/- (' + T('realizableWords') + ')')
    span_re(doc, 'The Distress value', r'Rs\.45,70,000/- \(Rupees Forty Five Lakhs Seventy Thousand only\)',
            '=Rs.' + T('distress') + '/- (' + T('distressWords') + ')')

    a = t[0]
    for r, key in ((1, 'purpose'), (2, 'inspectionDate'), (3, 'valuationDate'), (7, 'mvCertificate'), (9, 'flatDesc'),
                   (11, 'surveyLine'), (12, 'doorLine'), (13, 'villageLine'), (14, 'wardLine'), (17, 'planAuthority'),
                   (18, 'planVerified'), (19, 'planComments'), (20, 'postalAddress'), (21, 'cityTown'),
                   (22, 'areaResidential'), (23, 'areaCommercial'), (24, 'areaIndustrial')):
        cell(a, r, 8, key)
    for r, key in ((26, 'areaClass'), (27, 'areaUrban'), (28, 'localBodyType'), (29, 'govtEnactments'),
                   (41, 'parentLine'), (44, 'parentLine'), (45, 'occupancy'), (47, 'aptNature'), (48, 'aptLocation'),
                   (49, 'surveyLine2'), (50, 'doorLine'), (51, 'wardNoLine'), (52, 'localBodyName'), (54, 'localityType'),
                   (55, 'yearOfConstruction'), (56, 'floorsShort'), (57, 'structure'), (58, 'dwellingUnits'),
                   (59, 'quality'), (60, 'appearance'), (61, 'maintenance'), (62, 'facilities'), (63, 'lift'),
                   (64, 'protectedWater'), (65, 'sewerage'), (66, 'carParkingType'), (67, 'compoundWall'),
                   (68, 'pavement'), (70, 'floorLine'), (71, 'flatNoLine'), (73, 'fbEast'), (74, 'fbWest'),
                   (75, 'fbNorth'), (76, 'fbSouth'), (83, 'specRoof'), (84, 'specFlooring'), (85, 'specDoors'),
                   (86, 'specWindows'), (87, 'specFittings'), (88, 'specFinishing'), (89, 'houseTax'),
                   (90, 'assessmentNo'), (91, 'taxPaidName'), (92, 'taxAmountLine'), (95, 'flatMaintenance'),
                   (97, 'udsLine'), (99, 'fsi'), (101, 'flatClass'), (102, 'usage'), (103, 'occupancy2'),
                   (104, 'monthlyRent'), (106, 'marketability'), (107, 'advantages'), (108, 'negatives'),
                   (110, 'comparableRate'), (111, 'adoptedBasicRate')):
        cell(a, r, 7, key)
    cell(a, 5, 8, '=' + T('deedLabel') + ' :  ' + T('deedNo') + ', ', '=                      Dt: ' + T('deedDate'))
    cell(a, 6, 8, '=B.A.NO : ' + T('planNo') + ',', '= Dt : ' + T('planDate'))
    cell(a, 8, 8, '=Belongs to   : -', 'ownerLine1', 'owner1Addr', 'applicantLabel2', 'applicantName', 'applicantRel',
         'applicantAddr', 'ownerPhoneLine', '= ')
    cell(a, 15, 8, '=' + T('localBodyName') + ' of ', '=' + T('districtDotted') + ' (Dt).')
    cell(a, 16, 8, '= Approved Plan Date : ' + T('planDate') + '.')
    for r, side in ((31, 'North'), (32, 'South'), (33, 'East'), (34, 'West')):
        cell(a, r, 7, f'bdDeed{side}')
    for r, side in ((37, 'East'), (38, 'West'), (39, 'North'), (40, 'South')):
        cell(a, r, 7, f'dimDeed{side}')
        cell(a, r, 11, f'dimActual{side}')
    cell(a, 42, 10, 'gpsDms', 'gpsDecimal')
    cell(a, 53, 7, '=Door No : ' + T('doorNo') + ', ', '=Pin Code  : ' + T('pinCode'))
    for r in (78, 79, 80, 81):
        cell(a, r, 7, '= ', '= ', '=Undivided Share ' + T('udsSqyd') + ' Sqyds', '= (or) ' + T('udsCents') + ' Cents ',
             '= ', '= ', '= ')
    cell(a, 96, 7, 'deedExecutant', 'deedExecutantRelation')
    cell(a, 98, 7, 'plinthPlanLine', 'plinthActualLine')
    cell(a, 100, 7, 'carpetPlanLine', 'carpetActualLine')
    for r, key in ((113, 'buildingCalc'), (114, 'landCalc'), (115, 'guidelineNote'), (117, 'deprRateNote'),
                   (118, 'replacementLine'), (119, 'ageLine'), (120, 'lifeLine'), (121, 'deprLine'),
                   (122, 'deprBuildingLine'), (124, 'deprBuildingLine'), (125, 'landValueLine'), (126, 'compositeLine')):
        cell(a, r, 9, key)

    e = t[1]
    cell(e, 1, 2, 'plinthSqft')
    cell(e, 1, 3, 'unitRateLine')
    for r, key in ((1, 'compositeLine'), (2, 'x_wardrobes'), (3, 'x_showcases'), (4, 'x_kitchen'), (5, 'x_superfine'),
                   (6, 'x_interior'), (7, 'x_electrical'), (8, 'x_grills'), (9, 'x_potential'), (10, 'x_others'),
                   (11, 'grandTotalLine'), (12, 'sayLine')):
        cell(e, r, 4, key)
    g = t[2]
    cell(g, 1, 2, 'declBackground')
    cell(g, 2, 2, 'declPurpose')
    cell(g, 5, 2, 'declDates1', 'declDates2', 'declDates3')

    replace_all_body(doc, '29-01-2025', 'reportDate')
    places(doc)
    location_map(doc, 'LOCATION MAP', 'PHOTOS:')
    mark_images(doc, 'PHOTOS:', 'photo')
    span(doc, 'Justification:-', 'NGO Colony', 'landmark')
    whole(doc, '14°28\'23.2"N', T('gpsDms'))
    whole(doc, '14.473116, 78.837333', T('gpsDecimal'))


# --------------------------------------------------------------------------- OPEN SITE (one or two deeds)
def open_site(doc):
    t = doc.tables
    replace_all_body(doc, '2511140', 'fileNo')
    span(doc, 'District   :', 'Y.S.R.', 'districtDotted')
    span(doc, 'Branch   :', 'KADAPA BRANCH', 'bankBranchUpper')
    span_re(doc, 'Sarveswara', r'Sri\. G\. Sarveswara.*', 'ownerLine1')
    span_re(doc, '2/72-2', r'Door No :.*', 'owner1Addr')
    span(doc, '8512/2021', '8512/2021', 'deedNo')
    span(doc, '3.099', '3.099', 'deed1Cents')
    whole(doc, '8513/2021', T('deed2Line'))
    span(doc, 'Total Extent   :', '5.681', 'totalCents')
    span(doc, 'Plot No’s     :', '53, 54', 'plotNo')
    span(doc, 'Plot No’s     :', '8/2, 8-6A, 8/8, 8/11B, ', 'surveyNo')
    whole(doc, '7/6, 8-3A, 8-7A', T('surveyCont'))
    span_re(doc, 'Valuation Report of', r'Residential Vacant Site, .*', 'siteTitle')
    whole(doc, 'Kadapa Municipal Corporation of Y.S.R (Dt).', T('localBodyLine'))
    tb_span(doc, 'Valuation:', r'31,20,000', 'fmv')
    tb_span(doc, 'RUPEES', r'THIRTY ONE LAKHS TWENTY THOUSAND', 'fmvWordsCoreUpper')
    span(doc, 'Fair Market Value Of Above', '31,20,000', 'fmv')
    span(doc, 'The Realizable value', '28,00,000', 'realizable')
    span(doc, 'The distress value', '25,00,000', 'distress')

    a = t[0]
    for r, key in ((1, 'purpose'), (2, 'inspectionDate'), (3, 'valuationDate'), (6, 'planLine'), (7, 'mvCertificate'),
                   (9, 'tenure'), (11, 'surveyLine'), (12, 'plotLine'), (13, 'villageLine'), (14, 'wardLine'),
                   (16, 'postalAddress'), (17, 'cityTown'), (18, 'areaResidential'), (19, 'areaCommercial'),
                   (20, 'areaIndustrial'), (22, 'areaClass'), (23, 'areaUrban'), (25, 'govtEnactments'),
                   (26, 'agriConversion')):
        cell(a, r, 10, key)
    cell(a, 5, 10, 'deedLine1', 'deedLine2', '= ', '= ', '= ')
    cell(a, 8, 10, '=Belongs To:-', 'owner1NameLine', 'owner1RelLine', 'owner2NameLine', 'owner2RelLine', 'owner1Addr', '= ')
    for r in (15, 24):
        cell(a, r, 10, '=' + T('localBodyName') + ' Of ', '=' + T('districtDotted') + ' (Dt).')
    cell(a, 28, 8, 'deed1Head')
    cell(a, 28, 10, 'deed2Head')
    cell(a, 34, 8, 'totalHead')
    cell(a, 40, 8, 'deed1Head')
    cell(a, 40, 10, 'deed2Head')
    cell(a, 47, 8, 'totalHead')
    for r, side in ((29, 'North'), (30, 'South'), (31, 'East'), (32, 'West')):
        cell(a, r, 8, f'bdDeed{side}')
        cell(a, r, 10, f'bd2{side}')
    for r, side in ((35, 'North'), (36, 'South'), (37, 'East'), (38, 'West')):
        cell(a, r, 8, f'bdActual{side}')
    for r, side in ((41, 'North'), (42, 'South'), (43, 'East'), (44, 'West')):
        cell(a, r, 8, f'dimDeed{side}')
        cell(a, r, 10, f'dim2{side}')
    for r, side in ((48, 'North'), (49, 'South'), (50, 'East'), (51, 'West')):
        cell(a, r, 8, f'dimActual{side}')
    cell(a, 45, 8, 'deed1Extent')
    cell(a, 45, 10, 'deed2Extent')
    cell(a, 52, 8, 'totalExtentLine')
    cell(a, 53, 9, 'netExtentPlanLine')
    cell(a, 54, 11, 'gpsDms', 'gpsDecimal', '= ')
    for r in (56, 57):
        cell(a, r, 9, 'totalExtentA', 'totalExtentB')
    cell(a, 58, 9, 'occupancy')
    for i, key in enumerate(CHARS):
        cell(a, 60 + i, 9, key)
    cell(a, 78, 9, 'advantage1')
    cell(a, 80, 9, 'specialRemarks')
    for r in (85, 86, 87, 88):
        cell(a, r, 8, 'totalExtentA', 'totalExtentB')
    cell(a, 89, 8, 'marketRateLine')
    cell(a, 90, 8, 'guidelineNote')
    cell(a, 91, 8, 'adoptedRateLine', '= ')
    cell(a, 92, 8, 'landValueLine')
    for r, key in ((0, 'absA'), (6, 'absTotal'), (7, 'absSayAs')):
        cell(t[1], r, 3, key)
    g = t[2]
    cell(g, 1, 2, 'declBackground', 'declBackground2')
    cell(g, 2, 2, 'declPurpose')
    cell(g, 5, 2, 'declDates1', 'declDates2', 'declDates3')

    span_re(doc, 'Justification: -', r'(?<=It is In ).*?(?=, )', 'landmark')
    span_re(doc, 'Justification: -', r'Near Kadapa Public School, T\. Ramachandrapuram Village Field', 'nearVillage')
    span(doc, 'personally inspected', '24-11-2025', 'inspectionDate')
    replace_all_body(doc, '25-11-2025', 'reportDate')
    places(doc)
    location_map(doc, 'Location Map', 'Photo’s', close_up=False)
    mark_images(doc, 'Photo’s', 'photo', stop_text='Google Map')
    mark_images(doc, 'Google Map', 'map')
    whole(doc, '14°30\'10.3"N', T('gpsDms'))
    whole(doc, '14.502860, 78.788098', T('gpsDecimal'))


FORMATS = {'house': house, 'apartment': apartment, 'open_site': open_site}

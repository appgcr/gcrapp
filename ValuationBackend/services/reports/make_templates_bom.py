"""
Bank of Maharashtra: fill-in templates from the bank's own sample reports (bom_source/*.docx).

Run:  python3 make_templates.py bom [apartment|house]
Only the sample values are swapped for {{tags}}; the letterhead, tables, fonts, colours and
fixed wording stay exactly as the bank's file.
"""
from make_templates import (T, span, span_re, whole, cell, mark_images, replace_all_body)
from make_templates_bob import places
from make_templates_union import location_map
from make_templates_karnataka import swap_all


# --------------------------------------------------------------------------- APARTMENT
def apartment(doc):
    t = doc.tables
    replace_all_body(doc, '2605124', 'fileNo')
    span(doc, 'District    :', 'Y S R', 'district')
    span(doc, 'Branch    :', 'KADAPA', 'bankBranchUpper')
    span(doc, 'Elite Towers Appartment', 'Elite Towers', 'aptName')
    whole(doc, 'Stilt, Ground Floor + 4 Upper Floors', T('floorsDesc'))
    span(doc, 'Builder : -', 'M/S KHAN INFRA TECH', 'builderUpper')
    whole(doc, 'MANAGING PARTNER', T('partnerLine'))
    whole(doc, 'Chittemma, W/o', T('ownerLine1'))
    whole(doc, 'Kongareddypalle', T('owner1Addr'))
    whole(doc, 'Applicant :-', T('applicantLabel'))
    whole(doc, 'Jagadeeswara Devi', T('applicantLine'))
    whole(doc, 'Chaitanya Colony', T('applicantAddr'))
    span(doc, 'Deed No      ', '3805/2023', 'deedNo')
    span(doc, 'As Per Agreement Extent', '1.00 Cents (Out Of 10.00 Cents)', 'udsDeedLine')
    span(doc, 'Survey No’s    :', '561 & 601/4', 'surveyNo')
    span(doc, 'As Per Plan Extent', '0.905 Cents (Out Of 9.05 Cents)', 'udsPlanLine')
    span(doc, 'Flat No     :', '45/275-15', 'doorNo')
    span(doc, 'Flat No     :', '102', 'flatNo')
    span(doc, 'Flat No     :', 'First Floor', 'floorLine')
    span(doc, 'PLAN APPROVED UNDER', '1013/0110/B/KAD/CMPT/2024', 'planNo')
    span(doc, 'PLAN APPROVED UNDER', '19-02-2024', 'planDate')
    span_re(doc, 'Valuation Report of', r'Residential Semi Finished Building In .*', 'aptTitle')
    span(doc, 'Valuation:  Rs', '53,04,000', 'fmv')
    span(doc, '(RUPEES', 'FIFTY THREE LAKHS FOUR THOUSAND', 'fmvWordsCoreUpper')
    whole(doc, 'KADAPA MUNICIPAL CORPORATION Y.S.R (Dt).', T('localBodyLineUpper'))
    span_re(doc, 'As a result of my appraisal', r'Rs\. 53,04,000/- \(Rupees Fifty Three Lakhs Four Thousands only\)',
            '=Rs. ' + T('fmv') + '/- (' + T('fmvWords') + ')')
    span_re(doc, 'The Realizable value', r'Rs\.47,75,000/- \(Rupees Forty  Seven   Lakhs Seventy Five Thousand only\)',
            '=Rs.' + T('realizable') + '/- (' + T('realizableWords') + ')')
    span_re(doc, 'The distressed value', r'Rs\. 42,40,000/- \(Rupees Forty Two Lakhs Forty Thousand only\)',
            '=Rs. ' + T('distress') + '/- (' + T('distressWords') + ')')

    a = t[1]
    for r, key in ((1, 'purpose'), (2, 'inspectionDate'), (3, 'valuationDate'), (7, 'mvCertificate'), (9, 'tenure'),
                   (13, 'villageLine'), (16, 'postalLine'), (17, 'cityTown'), (18, 'areaResidential'),
                   (19, 'areaCommercial'), (20, 'areaIndustrial')):
        cell(a, r, 5, key)
    cell(a, 5, 5, '=Deed No.' + T('deedNo') + ', Dt: ' + T('deedDate'))
    cell(a, 6, 5, '=B.A.NO : ' + T('planNo') + '   Dt : ' + T('planDate') + '   ')
    cell(a, 8, 5, '=Belongs To :-', 'owner1NameLine', 'owner1RelLine', 'owner1Addr', 'applicantLabel', 'applicantLine',
         'applicantAddr')
    cell(a, 11, 5, '=Survey No’s : ' + T('surveyNo'))
    cell(a, 12, 5, '=Door No : ' + T('doorNo') + ',')
    cell(a, 14, 5, '=Ward No :- ' + T('wardNo') + ', ' + T('landmark') + ',')
    cell(a, 15, 5, '=' + T('localBodyName') + ' ', '=Of  ' + T('districtDotted') + ' (Dt).')
    b = t[2]
    for r, key in ((1, 'areaClass'), (2, 'areaUrban'), (3, 'localBodyType'), (4, 'govtEnactments'), (5, 'agriConversion'),
                   (22, 'parentLine'), (23, 'udsConsideredLine'), (24, 'occupancy')):
        cell(b, r, 6, key)
    for r, side in ((8, 'East'), (9, 'West'), (10, 'North'), (11, 'South')):
        cell(b, r, 4, f'bdDeed{side}')
        cell(b, r, 6, f'bdActual{side}')
    for r, side in ((14, 'East'), (15, 'West'), (16, 'North'), (17, 'South')):
        cell(b, r, 4, f'dimDeed{side}')
        cell(b, r, 6, f'dimActual{side}')
    cell(b, 18, 4, 'parentLine')
    cell(b, 18, 6, 'parentLine')
    cell(b, 19, 2, '=As Per Plan Extent : ' + T('parentPlanLine'))
    cell(b, 20, 7, 'gpsDecimal')
    cell(b, 21, 7, 'gpsDecimal')
    c = t[3]
    for r, key in ((1, 'aptNature'), (2, 'flatLocation'), (3, 'surveyLine2'), (4, 'aptNameQuoted'), (5, 'wardVillageLine'),
                   (6, 'localBodyName'), (7, 'postalLine2'), (8, 'localityType'), (9, 'yearOfConstruction'),
                   (10, 'floorsShort'), (11, 'structure'), (12, 'dwellingUnits'), (13, 'quality'), (14, 'appearance'),
                   (15, 'maintenance'), (16, 'facilities'), (17, 'lift'), (18, 'protectedWater'), (19, 'sewerage'),
                   (20, 'carParkingType'), (21, 'compoundWall'), (22, 'pavement'), (24, 'floorLine'), (25, 'flatNoLine'),
                   (27, 'fbNorth'), (28, 'fbSouth'), (29, 'fbEast'), (30, 'fbWest'), (37, 'specRoof'),
                   (38, 'specFlooring'), (39, 'specDoors'), (40, 'specWindows'), (41, 'specFittings'), (42, 'specFinishing')):
        cell(c, r, 3, key)
    for r in (32, 33, 34, 35):
        cell(c, r, 3, 'udsDeedSqydA', '=    Cents')
        cell(c, r, 4, 'udsPlanA', '=    Cents)')
    d = t[4]
    for r, key in ((0, 'houseTax'), (1, 'assessmentNo'), (2, 'taxPaidName'), (3, 'taxAmountLine'), (4, 'electricityNo'),
                   (5, 'meterName'), (6, 'flatMaintenance'), (8, 'udsAsPerPlan'), (9, 'plinthLine'), (11, 'carpetLine'),
                   (12, 'flatClass'), (13, 'usage'), (14, 'occupancy2'), (15, 'monthlyRent'), (17, 'marketability'),
                   (19, 'negatives')):
        cell(d, r, 4, key)
    cell(d, 7, 4, 'deedExecutant', 'deedExecutantRelation')
    cell(d, 18, 4, 'advantages')
    cell(d, 24, 6, 'buildingCalc', 'buildingCalc2')
    cell(d, 25, 6, 'landCalc', 'landCalc2')
    e = t[5]
    for r, key in ((2, 'replacementLine'), (3, 'ageNum'), (4, 'remainingLifeLine'), (5, 'lifeNum'), (6, 'deprBuildingLine'),
                   (9, 'deprBuildingLine'), (10, 'landValueLine'), (11, 'compositeLine')):
        cell(e, r, 3, key)
    g = t[6]
    cell(g, 1, 2, 'plinthQty')
    cell(g, 1, 4, 'compositeLine2')
    cell(g, 2, 4, 'carParkingLine')
    cell(g, 12, 4, 'grandTotalLine', 'sayLine')

    h = t[7]
    cell(h, 1, 2, 'declBackground')
    cell(h, 2, 2, 'declPurpose')
    cell(h, 5, 2, 'declDates1', 'declDates2', 'declDates3')
    replace_all_body(doc, '26-05-2026', 'reportDate')
    swap_all(doc, '25-05-2026', T('inspectionDate')) if any('25-05-2026' in p.text for p in doc.paragraphs) else None
    places(doc)
    location_map(doc, 'LOCATION – MAP', 'Photo’s', close_up=False)
    mark_images(doc, 'Photo’s', 'photo', stop_text='Google - Map’s')
    mark_images(doc, 'Google - Map’s', 'map')


# --------------------------------------------------------------------------- HOUSE
def house(doc):
    """Land & building (Parts A–F), same structure as the BoB house; values per Sqyd."""
    t = doc.tables
    replace_all_body(doc, '2611041', 'fileNo')
    span(doc, 'District    :', 'Y S R', 'district')
    span(doc, 'Branch     :', 'KADAPA', 'bankBranchUpper')
    whole(doc, 'Purushotham, S/o', T('ownerLine1'))
    whole(doc, '58/383-5-24, Thilak Nagar', T('owner1Addr'))
    span_re(doc, 'Valuation  Report  of Residential', r'Residential Building .*', 'houseTitle')
    span(doc, 'Fair Market Value Of Above Property is', '56,00,000', 'fmv')
    span(doc, 'The Realizable value of the above', '53,20,000', 'realizable')
    span(doc, 'The distress Value of the above', '50,40,000', 'distress')
    span(doc, 'Fair Market   Value  of Above', '56,00,000', 'fmv')
    span(doc, 'Realizable   Value  of Above', '53,20,000', 'realizable')
    span(doc, 'Distress  Value  of Above', '50,40,000', 'distress')
    span(doc, 'S.R.O.  Value  of Above', '9,05,325', 'sroValue')
    span(doc, 'personally  inspected', '09-11-2026', 'inspectionDate')

    a = t[1]
    for r, key in ((1, 'purpose'), (2, 'inspectionDate'), (3, 'valuationDate'), (5, 'deedLineBom'), (6, 'planLineBom'),
                   (7, 'mvCertificate'), (9, 'tenure'), (16, 'postalLine'), (17, 'cityTown'), (18, 'areaResidential'),
                   (19, 'areaCommercial'), (20, 'areaIndustrial'), (22, 'areaClass'), (23, 'areaUrban')):
        cell(a, r, 10, key)
    cell(a, 8, 10, '=Belongs To : -  ', '=' + T('owner1Name') + ', ', '=' + T('owner1Rel') + '.', 'owner1Addr', '= ', '= ')
    cell(a, 11, 10, '=Survey  No : ' + T('surveyNo') + ',')
    cell(a, 12, 10, '=Door No : ' + T('doorNo') + ',')
    cell(a, 13, 10, '=' + T('village') + ' Village Field')
    cell(a, 14, 10, '=Ward No : ' + T('wardNo') + ', In ' + T('landmark') + ',')
    cell(a, 15, 10, '=' + T('localBodyName') + '  Of  ', '=' + T('district') + ' (Dt).')
    for r, key in ((24, 'localBodyType'), (25, 'govtEnactments'), (26, 'agriConversion')):
        cell(a, r, 9, key)
    for r, side in ((29, 'East'), (30, 'West'), (31, 'North'), (32, 'South')):
        cell(a, r, 7, f'bdDeed{side}')
        cell(a, r, 9, f'bdActual{side}')
    for r, side in ((34, 'East'), (35, 'West'), (36, 'North'), (37, 'South')):
        cell(a, r, 7, f'dimDeed{side}')
        cell(a, r, 9, f'dimActual{side}')
    cell(a, 38, 7, 'extentDeedBom')
    cell(a, 38, 9, 'extentDeedBomA', 'extentDeedBomB')
    cell(a, 39, 3, '=Extent of  Site As Per Deed    : ' + T('extentDeedBom'))
    cell(a, 40, 3, '=Net Extent of  Site As Per Plan (Net Site Area) : ' + T('extentPlanBom'))
    for r in (41, 42):
        cell(a, r, 11, 'gpsDms', 'gpsDecimal', '= ')
    cell(a, 43, 8, 'extentDeedBomA', 'extentDeedBomB')
    cell(a, 44, 8, 'extentConsBomA', 'extentConsBomB')
    cell(a, 45, 8, 'occupancy', '= ')
    chars = ['locality', 'surroundings', 'flooding', 'civicAmenities', 'levelOfLand', 'landShape', 'landUse',
             'usageRestriction', 'layoutApproved', 'cornerPlot', 'roadFacilities', 'roadType', 'roadWidth',
             'landLocked', 'water', 'sewerage', 'power', 'advantage1', 'specialRemarks']
    for i, key in enumerate(chars):
        cell(a, 47 + i, 8, key)
    cell(a, 68, 7, 'sizeNorthSouth')
    cell(a, 69, 7, 'sizeEastWest')
    cell(a, 70, 7, 'extentConsBomA', 'extentConsBomB')
    cell(a, 71, 7, '= ', 'marketRateLine')
    cell(a, 72, 7, 'guidelineRateLine', 'guidelineValueLine', '=   Copy Enclosed')
    cell(a, 73, 7, 'adoptedRateLine')
    cell(a, 74, 7, 'landValueLine')
    for r, key in ((77, 'buildingType'), (78, 'constructionType'), (79, 'yearOfConstruction'), (80, 'ageLine'),
                   (81, 'remainingLifeLine'), (82, 'floorsLine')):
        cell(a, r, 7, key)
    cell(a, 84, 3, '=As Per Plan :  ', 'plinthPlan')
    cell(a, 84, 7, '=As Per Visit & Actual :  ', 'plinthActual')
    cell(a, 85, 3, '=Carpet Area:  ', 'carpetPlan')
    cell(a, 85, 7, '=Carpet Area:  ', 'carpetActual')
    cell(t[2], 1, 6, 'conditionExterior')
    cell(t[2], 2, 6, 'conditionInterior')
    cell(t[2], 3, 5, '=Date of Issue    : ' + T('planDate'), '= Date of Validity : ' + T('planValidity'))
    cell(t[3], 0, 3, 'planAuthority')
    cell(t[3], 1, 3, 'planVerified')
    cell(t[3], 2, 3, '= ', 'planComments')
    c = t[4]
    specs = ['foundation', 'basement', 'superstructure', 'joinery', 'rccWorks', 'plastering', 'flooring',
             'specialFinish', 'roofing', 'drainage']
    for i, key in enumerate(specs):
        cell(c, 1 + i, 3, f'specGF_{key}')
    for r, key in ((12, 'compoundWall'), (13, 'cwHeight'), (14, 'cwLength'), (15, 'cwType'), (17, 'wiring'),
                   (18, 'fittingsClass'), (19, 'fanPoints'), (20, 'plugPoints'), (21, 'electricalOther'),
                   (23, 'waterClosets'), (24, 'washBasins'), (25, 'urinals'), (26, 'bathTubs'), (27, 'waterMeter'),
                   (28, 'otherFixtures')):
        cell(c, r, 6, key)
    e = t[5]
    for ci, key in ((0, 'fl.sno'), (1, 'fl.label'), (2, 'fl.plinth'), (3, 'fl.height'), (4, 'fl.age'),
                    (5, 'fl.rate'), (6, 'fl.replacement'), (8, 'fl.net')):
        cell(e, 1, ci, key)
    cell(e, 1, 7, 'fl.depPct', 'fl.depAmount')
    cell(e, 2, 8, 'buildingTotalLine')
    for ti, keys in ((6, ['ex_portico', 'ex_frontDoor', 'ex_sitOut', 'ex_ohTank', 'ex_gates', 'partC']),
                     (7, ['am_wardrobes', 'am_glazedTiles', 'am_sinks', 'am_marble', 'am_interior', 'am_elevation',
                          'am_paneling', 'am_aluminium', 'am_handRails', 'am_falseCeiling', 'partD']),
                     (8, ['mi_toilet', 'mi_lumber', 'mi_sump', 'mi_trees', 'partE']),
                     (9, ['sv_water', 'sv_drainage', 'sv_compoundWall', 'sv_cbDeposits', 'sv_pavement', 'partF'])):
        for r, key in enumerate(keys):
            cell(t[ti], r, 3, key)
    for r, key in enumerate(['absA', 'absB', 'absC', 'absD', 'absE', 'absF', 'absTotal', 'absSayAs']):
        cell(t[10], r, 3, key)
    g = t[11]
    cell(g, 1, 2, 'declBackground')
    cell(g, 2, 2, 'declPurpose')
    cell(g, 5, 2, 'declDates1', 'declDates2', 'declDates3')

    replace_all_body(doc, '10-11-2026', 'reportDate')
    places(doc)
    location_map(doc, 'LOCATION MAP', 'PHOTO’S', close_up=False)
    mark_images(doc, 'PHOTO’S', 'photo', stop_text='GOOGLE MAP')
    mark_images(doc, 'GOOGLE MAP', 'map')
    whole(doc, '14°28', T('gpsDms'))
    whole(doc, '14.472000, 78.810056', T('gpsDecimal'))


FORMATS = {'apartment': apartment, 'house': house}

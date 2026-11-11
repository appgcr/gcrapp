"""
Bank of Maharashtra: fill-in templates from the bank's own sample reports (bom_source/*.docx).

Run:  python3 make_templates.py bom [apartment]
Only the sample values are swapped for {{tags}}; the letterhead, tables, fonts, colours and
fixed wording stay exactly as the bank's file. (The house sample is an old .doc file — it is added
once the bank's file is re-saved as .docx.)
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


FORMATS = {'apartment': apartment}

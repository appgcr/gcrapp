"""
UCO Bank (United Commercial Bank): fill-in templates from the bank's own sample reports (uco_source/*.docx).

Run:  python3 make_templates.py uco [house|apartment|open_site]
Only the sample values are swapped for {{tags}}; the letterhead, tables, fonts, colours and
fixed wording stay exactly as the bank's file.
"""
from make_templates import (T, span, span_re, whole, cell, mark_images, replace_all_body)
from make_templates_bob import places
from make_templates_union import location_map
from make_templates_pnb import pending_works

CHARS = ['locality', 'surroundings', 'flooding', 'civicAmenities', 'levelOfLand', 'landShape', 'landUse',
         'usageRestriction', 'layoutApproved', 'cornerPlot', 'roadFacilities', 'roadType', 'roadWidth',
         'landLocked', 'water', 'sewerage', 'power']


# --------------------------------------------------------------------------- HOUSE
def house(doc):
    t = doc.tables
    replace_all_body(doc, '2602095', 'fileNo')
    span(doc, 'District   :', 'Y.S.R', 'districtDotted')
    span(doc, 'Branch  :', 'RTC BUSSTAND BRANCH', 'bankBranchUpper')
    whole(doc, 'Applicant :-', T('applicantLabel'))
    span_re(doc, 'U. Konda Reddy', r'Smt U\. Radha.*', 'applicantLine')
    whole(doc, 'Siva Seshadri', T('applicant2Line'))
    whole(doc, 'Kandimallayapalli', T('applicantAddr'))
    whole(doc, 'Smt V. Anuradha', T('ownerLine1'))
    whole(doc, 'Vem Nagar, Viswanathapuram, Kadapa, Y.S.R (DT).', T('owner1Addr'))
    span(doc, 'DEED NO', '5436/2022', 'deedNo')
    span(doc, 'DEED NO', '4.84', 'netExtentCents')
    span(doc, 'DOOR NO', '101/70-55', 'doorNo')
    span(doc, 'SURVEY NO’s', '129, 130/2, 127/4, 162/2, 162/3, 127/4, 163, 128, 164,', 'surveyNoComma')
    span(doc, 'PLAN APPROVED UNDER', 'PER/1013/0111/2026', 'planNo')
    span(doc, 'PLAN APPROVED UNDER', '09-02-2026', 'planDate')
    span_re(doc, 'Valuation Report of', r'Residential Building \(GF\) At .*', 'houseTitle')
    span(doc, 'Valuation   :', '58,35,000', 'fmv')
    span(doc, '(RUPEES', 'FIFTY EIGHT LAKHS THIRTY FIVE THOUSAND', 'fmvWordsCoreUpper')
    whole(doc, 'Kadapa Municipal Corporation, Y.S.R Dist.', T('localBodyLine'))
    span_re(doc, 'Justification :-', r'(?<=it is in ).*?(?=, in this area)', 'villageLine')
    span(doc, 'Fair Market Value Of Above', '58,35,000', 'fmv')
    span(doc, 'The Realizable value', '55,40,000', 'realizable')
    span(doc, 'The distress Value', '52,50,000', 'distress')

    a = t[0]
    for r, key in ((1, 'purpose'), (2, 'inspectionDate'), (3, 'valuationDate'), (7, 'mvCertificate'), (9, 'briefDesc'),
                   (13, 'villageName'), (16, 'postalAddress')):
        cell(a, r, 13, key)
    cell(a, 5, 13, '=Deed No : ' + T('deedNo') + ', Dt : ' + T('deedDate') + '.')
    cell(a, 6, 13, '=B.A NO :-  ' + T('planNo') + ', ', '=DT :- ' + T('planDate'))
    cell(a, 8, 13, '=Applicant :-  ', 'applicantName', 'applicantRel', 'applicant2Name', 'applicant2Rel', 'applicantAddr',
         '=Belongs To :-', 'ownerLine1', 'owner1Addr')
    cell(a, 11, 13, '= Plot No: ' + T('plotNo') + ', ', '=Survey No : ' + T('surveyNoComma'))
    cell(a, 12, 13, '=Door No :  ' + T('doorNo') + ',')
    cell(a, 14, 13, '=Ward No: ' + T('wardNo') + ', ')
    cell(a, 15, 13, 'localBodyLine2', '= ')
    for r in range(17, 27):
        pass
    for r, side in ((29, 'North'), (30, 'South'), (31, 'East'), (32, 'West')):
        cell(a, r, 10, f'bdDeed{side}')
        cell(a, r, 14, f'bdActual{side}')
    for r, side in ((35, 'North'), (36, 'South'), (37, 'East'), (38, 'West')):
        cell(a, r, 10, f'dimDeed{side}')
        cell(a, r, 14, f'dimActual{side}')
    cell(a, 39, 10, 'extentDeedLine')
    cell(a, 39, 14, 'extentDeedLine')
    cell(a, 40, 4, '=As per Plan Net Extent : ' + T('extentPlanLine'))
    cell(a, 41, 15, 'gpsDms', 'gpsDecimal', '= ')
    cell(a, 43, 11, 'extentDeedLine')
    cell(a, 44, 11, 'extentPlanLine')
    cell(a, 45, 11, 'extentConsideredLine')
    cell(a, 46, 11, 'occupancy')
    for i, key in enumerate(CHARS):
        cell(a, 48 + i, 12, key)
    cell(a, 60, 12, 'roadWidth', '= ', '= ')
    cell(a, 66, 12, 'advantage1')
    cell(a, 67, 12, 'specialRemarks')
    for r, key in ((70, 'extentDeedLine'), (71, 'extentDeedLine'), (72, 'extentDeedLine'), (73, 'extentConsideredLine'),
                   (74, 'marketRateLine'), (75, 'guidelineNote'), (76, 'adoptedRateLine'), (77, 'landValueLine')):
        cell(a, r, 11, key)

    b = t[1]
    for r, key in ((2, 'buildingType'), (3, 'constructionType'), (4, 'yearOfConstruction'), (5, 'ageLine'),
                   (6, 'remainingLifeLine'), (7, 'floorsLine'), (13, 'conditionExterior'), (14, 'conditionInterior'),
                   (16, 'planAuthority'), (17, 'planVerified'), (18, 'planComments')):
        cell(b, r, 4, key)
    cell(b, 10, 2, 'plinthLines')
    cell(b, 10, 4, 'plinthLines')
    cell(b, 11, 2, '=Carpet Area :', 'carpetLines', '= ', '= ')
    cell(b, 11, 4, '=Carpet Area :', 'carpetLines', '= ', '= ')
    cell(b, 15, 4, '=B. .A NO :- ' + T('planNo') + ', ', '=DT :- ' + T('planDate'))

    c = t[2]
    specs = ['foundation', 'basement', 'superstructure', 'joinery', 'rccWorks', 'plastering', 'flooring',
             'specialFinish', 'roofing', 'drainage']
    for i, key in enumerate(specs):
        cell(c, 1 + i, 4, f'specGF_{key}')
    for r, key in ((12, 'compoundWall'), (13, 'cwHeight'), (14, 'cwLength'), (15, 'cwType'), (17, 'wiring'),
                   (18, 'fittingsClass'), (19, 'lightPoints'), (20, 'fanPoints'), (21, 'plugPoints'),
                   (22, 'electricalOther'), (24, 'waterClosets'), (25, 'washBasins'), (26, 'urinals'),
                   (27, 'bathTubs'), (28, 'waterMeter'), (29, 'otherFixtures')):
        cell(c, r, 6, key)

    e = t[3]
    for ci, key in ((0, 'fl.sno'), (1, 'fl.label'), (3, 'fl.height'), (5, 'fl.rate'), (6, 'fl.replacement'),
                    (8, 'fl.net')):
        cell(e, 1, ci, key)
    cell(e, 1, 2, 'fl.plinthNum', '= Sqft')
    cell(e, 1, 4, 'fl.ageWord')
    cell(e, 1, 7, 'fl.depPct', 'fl.depAmount')
    cell(e, 2, 8, 'buildingTotalLine')

    for ti, keys in ((4, ['ex_portico', 'ex_frontDoor', 'ex_sitOut', 'ex_ohTank', 'ex_gates', 'partC']),
                     (5, ['am_wardrobes', 'am_glazedTiles', 'am_sinks', 'am_marble', 'am_interior', 'am_elevation',
                          'am_paneling', 'am_aluminium', 'am_handRails', 'am_falseCeiling', 'am_lift', 'partD']),
                     (6, ['mi_toilet', 'mi_lumber', 'mi_sump', 'mi_trees', 'partE']),
                     (7, ['sv_water', 'sv_drainage', 'sv_compoundWall', 'sv_cbDeposits', 'sv_sump', 'partF'])):
        for r, key in enumerate(keys):
            cell(t[ti], r, 3, key)
    for r, key in enumerate(['absA', 'absB', 'absC', 'absD', 'absE', 'absF', 'absTotal', 'absSayAs']):
        cell(t[8], r, 3, key)
    g = t[9]
    cell(g, 1, 2, 'declBackground')
    cell(g, 2, 2, 'declPurpose')
    cell(g, 5, 2, 'declDates1', 'declDates2', 'declDates3')

    replace_all_body(doc, '17-02-2026', 'reportDate')
    places(doc)
    location_map(doc, 'Location Map', 'PHOTOS :', close_up=False)
    mark_images(doc, 'PHOTOS :', 'photo')
    whole(doc, '14°27\'08.3"N', T('gpsDms'))
    whole(doc, '14.452314, 78.824351', T('gpsDecimal'))


# --------------------------------------------------------------------------- APARTMENT
def apartment(doc):
    t = doc.tables
    replace_all_body(doc, '2603095', 'fileNo')
    span(doc, 'District   :', 'Y.S.R.', 'districtDotted')
    span(doc, 'Branch    :', 'RTC BRANCH, KADAPA', 'bankBranchUpper')
    span(doc, 'SREEKAREE SADAN', 'SREEKAREE SADAN', 'aptNameUpper')
    whole(doc, 'Stilt + Ground Floor + 4 Upper Floors', T('floorsDesc'))
    whole(doc, 'M/s SreeKaree Constructions', T('firmName'))
    whole(doc, 'Jaya Rami Reddy, S/o', T('ownerLine1'))
    whole(doc, 'Near Fly-Over', T('owner1Addr'))
    whole(doc, 'Applicant:-', T('applicantLabel'))
    whole(doc, 'Kamalamma', T('applicantLine'))
    whole(doc, 'Vasavee Enclave', T('applicantAddr'))
    span(doc, 'Deed No :', '5046/2023', 'deedNo')
    span(doc, 'Deed No :', '74.42', 'udsSqyd')
    span(doc, 'Deed No :', '2178', 'parentSqydShort')
    span(doc, '7588/2023', '7588/2023', 'deed2No')
    span(doc, 'Rectification Deed No  :   ', '356, 355/3 & 355/2', 'surveyNo')
    whole(doc, '11865/2024', T('deed3Line'))
    span(doc, 'Door No   :', '44/35-1-10', 'doorNo')
    span(doc, 'Door No   :', '107', 'flatNo')
    span(doc, 'Door No   :', 'First Floor', 'floorLine')
    span(doc, 'PLAN APPROVED UNDER', '1013/1193/B/KAD/CMPT/2023', 'planNo')
    span(doc, 'PLAN APPROVED UNDER', '16-10-2023', 'planDate')
    whole(doc, 'AP RERA PROJECT', T('reraLine'))
    span_re(doc, 'Valuation Report of', r'Residential Semi Finished Flat In .*', 'aptTitle')
    span(doc, 'UN DIVIDED SHARE', '74.42', 'udsSqyd')
    span(doc, 'UN DIVIDED SHARE', '2178.00', 'parentSqyd')
    span(doc, 'Valuation   :', '46,49,000', 'fmv')
    span(doc, '(RUPEES :', 'FORTY SIX LAKHS FOURTY NINE THOUSAND', 'fmvWordsCoreUpper')
    whole(doc, 'Kadapa Municipal Corporation, Y S R (DT)', T('localBodyLine'))
    span(doc, 'As a result of my appraisal', '46,49,000', 'fmv')
    span(doc, 'The Realizable value', '44,20,000', 'realizable')
    span(doc, 'The distress value', '41,80,000', 'distress')

    a = t[0]
    for r, key in ((1, 'purpose'), (2, 'inspectionDate'), (3, 'valuationDate'), (7, 'mvCertificate'), (9, 'flatDescUpper'),
                   (13, 'villageLine'), (14, 'wardLine'), (15, 'localBodyLine'), (28, 'localBodyType'),
                   (29, 'govtEnactments'), (43, 'parentLine'), (47, 'occupancy'), (50, 'aptLocation'),
                   (55, 'pinLine'), (57, 'yearOfConstruction'), (73, 'flatNoLine'), (96, 'houseTax'),
                   (97, 'assessmentNo'), (98, 'taxPaidName'), (99, 'taxAmountLine'), (102, 'flatMaintenance'),
                   (104, 'udsCentsLine'), (105, 'plinthLine'), (106, 'fsi'), (107, 'carpetLine'), (108, 'flatClass'),
                   (109, 'usage'), (110, 'occupancy2'), (111, 'monthlyRent'), (113, 'marketability'),
                   (114, 'advantages'), (115, 'negatives'), (117, 'comparableRate'), (118, 'adoptedBasicRate')):
        cell(a, r, 8, key)
    cell(a, 5, 8, '=Xerox Copy Of', '=Deed No : ' + T('deedNo') + ', Date : ' + T('deedDate'), 'deedOthersLine')
    cell(a, 6, 8, '=B.A. NO : ' + T('planNo') + ',', '= Dt : ' + T('planDate') + '.', 'reraLine')
    cell(a, 8, 8, '=Belongs To:-      ', 'firmName', 'owner1NameLine', 'owner1RelLine', 'owner1Addr', 'applicantLabel',
         'applicantName', 'applicantRel', 'applicantAddr')
    cell(a, 11, 8, '=Survey No’s : ' + T('surveyNo') + ', ')
    cell(a, 12, 8, '= Door No : ' + T('doorNo') + ',')
    cell(a, 16, 8, '= B.A. NO : ' + T('planNo') + ',', '=Approved Plan Date : ' + T('planDate') + '.', 'planValidityLine')
    for r, side in ((32, 'North'), (33, 'South'), (34, 'East'), (35, 'West')):
        cell(a, r, 6, f'bdDeed{side}')
        cell(a, r, 11, f'bdActual{side}')
    for r, side in ((38, 'North'), (39, 'South'), (40, 'East'), (41, 'West')):
        cell(a, r, 6, f'dimDeed{side}')
        cell(a, r, 10, f'dimActual{side}')
    cell(a, 42, 6, 'parentLine')
    cell(a, 42, 10, 'parentLine')
    cell(a, 44, 13, 'latitude')
    cell(a, 45, 13, 'longitude')
    cell(a, 46, 8, '= ', 'udsOutOf')

    replace_all_body(doc, '23-03-2026', 'reportDate')
    places(doc)
    location_map(doc, 'LOCATION MAP', 'PHOTOS', close_up=False)
    mark_images(doc, 'PHOTOS', 'photo', stop_text='GOOGLE- MAP')
    mark_images(doc, 'GOOGLE- MAP', 'map')
    _apartment_rest(doc)


def _apartment_rest(doc):
    import re
    from docx_tools import para_text
    t = doc.tables
    a = t[0]
    rows = {para_text(r.cells[1].paragraphs[0]).strip(): i for i, r in enumerate(a.rows) if r.cells[1].paragraphs}
    for label, key in (('Nature of the Apartment', 'aptNature'), ('T. S. No.', 'surveyLine2'), ('Door No.', 'doorLine'),
                       ('Ward No.', 'villageWardLine'), ('Village/ Municipality / Corporation', 'localBodyName'),
                       ('Number of Floors', 'floorsShort'), ('Type of Structure', 'structure'),
                       ('Number of Dwelling units in the building', 'dwellingUnits'),
                       ('Quality of Construction', 'quality'), ('Appearance of the Building', 'appearance'),
                       ('Maintenance of the Building', 'maintenance'), ('Facilities Available', 'facilities'),
                       ('Lift', 'lift'), ('Protected Water Supply', 'protectedWater'), ('Underground Sewerage', 'sewerage'),
                       ('Car Parking - Open/ Covered', 'carParkingType'), ('Is Compound wall existing?', 'compoundWall'),
                       ('Is pavement laid around the Building', 'pavement'),
                       ('The floor on which the flat is situated', 'floorLine'),
                       ('Roof', 'specRoof'), ('Flooring', 'specFlooring'), ('Doors', 'specDoors'), ('Windows', 'specWindows'),
                       ('Fittings', 'specFittings'), ('Finishing', 'specFinishing')):
        if label in rows:
            cell(a, rows[label], 8, key)
    # flat boundaries (deed rows 75-78, actual rows 80-83) and the flat's share rows 85-88
    for base, pref in ((75, 'fb'), (80, 'fbActual')):
        for i, side in enumerate(('North', 'South', 'East', 'West')):
            r = a.rows[base + i]
            ci = max(i2 for i2, c in enumerate(r.cells) if c.text.strip() and c._tc is not r.cells[1]._tc)
            cell(a, base + i, ci, f'{pref}{side}')
    for r in (85, 86, 87, 88):
        row = a.rows[r]
        ci = max(i2 for i2, c in enumerate(row.cells) if c.text.strip() and c._tc is not row.cells[1]._tc)
        cell(a, r, ci, 'udsOutOf')
    cell(a, 103, 8, 'firmName', 'owner1NameLine', 'owner1RelLine')
    cell(a, 120, 12, 'buildingCalc')
    cell(a, 121, 12, 'landCalc')
    cell(a, 122, 12, 'guidelineNote')
    b = t[1]
    for r, key in ((2, 'replacementLine'), (3, 'ageLine'), (4, 'lifeLine'), (5, 'deprLine'), (6, 'deprBuildingLine'),
                   (8, 'deprBuildingLine'), (9, 'landValueLine')):
        cell(b, r, 3, key)
    cell(b, 10, 3, 'compositeLine', 'compositeSayLine')
    e = t[2]
    cell(e, 1, 2, 'plinthLine')
    cell(e, 1, 3, 'unitRateLine')
    for r, key in ((1, 'sayValueLine'), (2, 'x_wardrobes'), (3, 'x_showcases'), (4, 'x_kitchen'), (5, 'x_superfine'),
                   (6, 'x_interior'), (7, 'x_electrical'), (8, 'x_grills'), (9, 'x_potential'), (10, 'x_others'),
                   (11, 'grandTotalLine'), (12, 'sayValueLine')):
        cell(e, r, 4, key)
    g = t[3]
    cell(g, 1, 2, 'declBackground', 'declBuilding')
    cell(g, 2, 2, 'declPurpose')
    cell(g, 5, 2, 'declDates1', 'declDates2', 'declDates3')
    span_re(doc, 'Justification:-', r'Near Kesava Reddy School', 'nearLine')
    whole(doc, '14.457079, 78.809912', T('gpsDecimal'))
    pending_works(doc, 'PENDING WORK', 'Kamalamma', r'Smt\. M\. Kamalamma.*Reddy\.', '32,00,000.00', 'THIRTY TWO LAKHS')


# --------------------------------------------------------------------------- OPEN SITE (one or two land items)
def open_site(doc):
    t = doc.tables
    replace_all_body(doc, '2605074', 'fileNo')
    span(doc, 'District   :', 'Y.S.R', 'districtDotted')
    span(doc, 'Branch :', 'RTC BUSSTAND BRANCH', 'bankBranchUpper')
    whole(doc, 'Vijaya Lakshmi', T('ownerLine1'))
    whole(doc, 'Narayandri Apartment', T('owner1Addr'))
    whole(doc, 'Applicant / Purchaser :-', T('applicantLabel'))
    whole(doc, 'Vishnu Vardhan', T('applicantLine'))
    whole(doc, '13/2229', T('applicantAddr'))
    span(doc, 'DEED NO', '12110/2024', 'deedNo')
    span(doc, 'DEED NO', '3.39', 'netExtentCents')
    span(doc, 'DOOR NO', '44/29-61-6', 'doorNo')
    span(doc, 'DOOR NO', '386/1, 387/3B', 'surveyNo')
    whole(doc, '& 386/2', ' ')
    span(doc, 'PLAN APPROVED UNDER', 'Tentative Plan', 'planNo')
    span_re(doc, 'Valuation Report of', r'Residential Vacant site At .*', 'siteTitle')
    span(doc, 'Valuation   :', '51,50,000', 'fmv')
    span(doc, '(RUPEES', 'FIFTY ONE LAKHS FIFTY THOUSAND', 'fmvWordsCoreUpper')
    whole(doc, 'Kadapa Municipal Corporation, Y.S.R Dist.', T('localBodyLine'))
    span(doc, 'Fair Market Value Of Above', '51,50,000', 'fmv')
    span(doc, 'The Realizable value', '46,35,000', 'realizable')
    span(doc, 'The distress Value', '41,20,000', 'distress')

    a = t[0]
    for r, key in ((1, 'purpose'), (2, 'inspectionDate'), (3, 'valuationDate'), (7, 'mvCertificate'), (9, 'briefDesc'),
                   (13, 'villageLine'), (14, 'wardLine'), (15, 'localBodyLine2'), (16, 'postalAddress')):
        cell(a, r, 14, key)
    cell(a, 5, 14, '=Deed No : ' + T('deedNo') + ', Dt : ' + T('deedDate') + '.')
    cell(a, 6, 14, '=B.A.No:  ' + T('planNo'))
    cell(a, 8, 14, 'applicantLabel', 'applicantName', 'applicantRel', 'applicantAddr', '=Belongs To :-', 'ownerLine1',
         'owner1Addr')
    cell(a, 11, 14, '=Survey No : ' + T('surveyNo') + ', ', '=Plot No:- ' + T('plotNo') + ',')
    cell(a, 12, 14, '=Door No :  ' + T('doorNo') + ',')
    for r, key in ((17, 'cityTown'), (18, 'areaResidential'), (19, 'areaCommercial'), (20, 'areaIndustrial'),
                   (22, 'areaClass'), (23, 'areaUrban'), (24, 'localBodyType')):
        cell(a, r, 13, key)
    for r, side in ((29, 'North'), (30, 'South'), (31, 'East'), (32, 'West')):
        cell(a, r, 10, f'bdDeed{side}')
        cell(a, r, 15, f'bdActual{side}')
    cell(a, 34, 4, 'item1Head')
    cell(a, 40, 4, 'item2Head')
    for r, side in ((35, 'North'), (36, 'South'), (37, 'East'), (38, 'West')):
        cell(a, r, 11, f'dimDeed{side}')
        cell(a, r, 15, f'dimActual{side}')
    for r, side in ((41, 'North'), (42, 'South'), (43, 'East'), (44, 'West')):
        cell(a, r, 11, f'dim2{side}')
        cell(a, r, 15, f'dim2Actual{side}')
    cell(a, 39, 11, 'item1Extent')
    cell(a, 39, 15, 'item1Extent')
    cell(a, 45, 11, 'item2Extent')
    cell(a, 45, 15, 'item2Extent')
    cell(a, 46, 4, 'totalExtentLine')
    cell(a, 47, 4, '=As per Plan Net Extent : ' + T('extentPlanLine'))
    cell(a, 48, 16, 'gpsDecimal', '= ')
    cell(a, 50, 12, 'extentTotalLine')
    cell(a, 51, 12, 'extentPlanLine')
    cell(a, 52, 12, 'extentConsideredLine')
    cell(a, 53, 12, 'occupancy')
    for i, key in enumerate(CHARS):
        cell(a, 55 + i, 13, key)
    cell(a, 73, 13, 'advantage1')
    cell(a, 74, 13, 'specialRemarks')
    for r, key in ((77, 'extentTotalLine'), (78, 'extentTotalLine'), (79, 'extentTotalLine'), (80, 'extentConsideredLine'),
                   (81, 'marketRateLine'), (82, 'guidelineNote'), (83, 'adoptedRateLine'), (84, 'landValueLine')):
        cell(a, r, 12, key)
    for r, key in ((0, 'absA'), (6, 'absTotal'), (7, 'absSayAs')):
        cell(t[1], r, 3, key)
    g = t[2]
    cell(g, 1, 2, 'declBackground')
    cell(g, 2, 2, 'declPurpose')
    cell(g, 5, 2, 'declDates1', 'declDates2', 'declDates3')

    span(doc, 'Date   :', '26-05-2026', 'reportDate')
    replace_all_body(doc, '26-05-2026', 'reportDate')
    replace_all_body(doc, '25-05-2026', 'inspectionDate')
    places(doc)
    location_map(doc, 'LOCATION MAP:', 'PHOTO’S', close_up=False)
    mark_images(doc, 'PHOTO’S', 'photo', stop_text='GOOGLE MAP')
    mark_images(doc, 'GOOGLE MAP', 'map')


FORMATS = {'house': house, 'apartment': apartment, 'open_site': open_site}

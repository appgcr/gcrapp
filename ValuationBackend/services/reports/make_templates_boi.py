"""
Bank of India: fill-in templates from the bank's own sample reports (boi_source/*.docx).
Run:  python3 make_templates.py boi [house|apartment|open_site|agriculture]
"""
import re
from docx_tools import find_para, para_text, replace_span
from make_templates import (T, span, span_re, whole, cell, cspan, set_cell_para, mark_region, mark_images,
                            replace_all_body, _drop_tabs, insert_marker_after, append_marker, p_span_re)
from make_templates_bob import places, rename_image, tb_span  # noqa: F401  (shared helpers)

SURVEY = '247/1, 247/3, 247/4, 247/5, 248/1, 250/5P, 250/4, 250/6, 250/7, 250/8, 250/9, 251, 252, 253, 255, 256, 257 & 258'


# --------------------------------------------------------------------------- HOUSE
def house(doc):
    t = doc.tables
    span(doc, 'File No', '2605132', 'fileNo')
    _drop_tabs(find_para(doc, 'File No'), 2)
    span(doc, 'District   :', 'Y S R', 'district')
    span(doc, 'Branch    :', 'KADAPA BRANCH', 'bankBranchUpper')
    span(doc, 'Kadapa  Branch,', 'Kadapa  Branch', 'bankBranchName')
    span(doc, 'Hemanth', 'Sri T. Hemanth Kumar', 'owner1Name')
    span(doc, 'Krishna Murthy', 'S/o. T. Krishna Murthy Prasad', 'owner1Rel')
    span_re(doc, 'Habeebullah', r'Door No : .*\(DT\)\.', 'owner1Addr')
    span(doc, 'Applicant  :-', 'Applicant', 'applicantLabel')
    span(doc, 'Triveni', 'Smt V. Triveni', 'applicantName')
    span(doc, 'Rama Krishna Prasad', 'W/o. V. Rama Krishna Prasad', 'applicantRel')
    span_re(doc, 'Varada', r'Door No : .*\(DT\)\.', 'applicantAddr')
    span(doc, 'Net Extent', '1959/2021', 'deedNo')
    span(doc, 'Net Extent', '4.045', 'netExtentCents')
    span(doc, 'Plot  No', '38/172-3-28', 'doorNo')
    span(doc, 'Plot  No', '115', 'plotNo')
    span(doc, SURVEY, SURVEY, 'surveyNo')
    span(doc, 'Approved Plan Under', '1013/0985/B/KAD/cch/2024', 'planNo')
    span(doc, 'Approved Plan Under', '28-02-2025', 'planDate')
    for L in ('Valuation Report Of', 'Justification'):
        if L == 'Valuation Report Of':
            span(doc, L, 'Residential Building (GF+FF)', 'buildingDesc')
        span(doc, L, SURVEY, 'surveyNo')
        span(doc, L, '38/172-3-28', 'doorNo')
        span(doc, L, '38', 'wardNo')
        span(doc, L, 'Prathap Society Colony', 'landmark')
        span(doc, L, 'Chinnachowk', 'village')
        span(doc, L, 'Kadapa Municipal Corporation of Y.S.R Dist.', 'localBody')
    span(doc, 'Valuation   :', '1,13,78,000', 'fmv')
    span_re(doc, 'ONE CRORE', r'\(RUPEES.*ONLY\)', '=(' + T('fmvWordsUpper') + ')')
    span_re(doc, 'Corporation, Y.S.R Dist', r'Kadapa.*', 'localBodyLine')
    span(doc, 'Fair Market Value Of', '1,13,78,000', 'fmv')
    span(doc, 'Realizable value', '1,08,10,000', 'realizable')
    span(doc, 'distress', '1,02,40,000', 'distress')
    span(doc, 'Guide Line Value', '16,45,014', 'guidelineValue')

    a = t[0]
    for r, key in ((1, 'purpose'), (2, 'inspectionDate'), (3, 'valuationDate'), (7, 'mvCertificate'), (9, 'tenure'),
                   (16, 'postalAddress'), (17, 'cityTown'), (18, 'areaResidential'), (19, 'areaCommercial'),
                   (20, 'areaIndustrial'), (22, 'areaClass'), (23, 'areaUrban'), (24, 'localBodyType')):
        cell(a, r, 4, key)
    cspan(a, 5, 4, [('1959/2021', 'deedNo'), ('27-02-2021', 'deedDate')])
    cspan(a, 6, 4, [('1013/0985/B/KAD/cch/2024', 'planNo')], para=0)
    cspan(a, 6, 4, [('28-02-2025', 'planDate')], para=1)
    for i, (key, suffix) in enumerate((('owner1Name', ',  '), ('owner1Rel', '.'), ('owner1Addr', ''),
                                       ('applicantLabel', '  :-'), ('applicantName', ',  '), ('applicantRel', '.'),
                                       ('applicantAddr', '')), start=1):
        set_cell_para(a, 8, 4, i, T(key) + suffix)
    cspan(a, 11, 4, [(SURVEY, 'surveyNo'), ('115', 'plotNo')])
    cspan(a, 12, 4, [('38/172-3-28', 'doorNo')])
    cspan(a, 13, 4, [('Chinnachowk', 'village')])
    cspan(a, 14, 4, [('38', 'wardNo'), ('Near Sushanth Motels', 'nearBy')])
    cspan(a, 15, 4, [('Kadapa Municipal Corporation', 'localBodyName'), ('Y.S.R', 'district')])
    cell(t[1], 0, 2, 'govtEnactments')
    cell(t[1], 1, 2, 'agriConversion')

    b = t[2]
    for r, side in ((2, 'North'), (3, 'South'), (4, 'East'), (5, 'West')):
        cell(b, r, 2, f'bdDeed{side}')
        cell(b, r, 3, f'bdActual{side}')
    for r, side in ((8, 'North'), (9, 'South'), (10, 'East'), (11, 'West')):
        cell(b, r, 2, f'dimDeed{side}')
        cell(b, r, 4, f'dimActual{side}')
    cell(b, 12, 1, '=Extent : ' + T('extentDeed'))
    cell(b, 12, 4, '=Extent : ' + T('extentActual'))
    cell(b, 13, 1, '=As per plan Net Extent :  ' + T('netExtentPlan'))
    c = t[3]
    for r, key in ((1, 'netExtentPlan'), (4, 'extentSite'), (5, 'extentConsidered'), (6, 'occupancy')):
        cell(c, r, 2, key)
    cell(c, 2, 3, 'gpsDecimal')
    d = t[4]
    chars = ['locality', 'surroundings', 'flooding', 'civicAmenities', 'levelOfLand', 'landShape', 'landUse',
             'usageRestriction', 'layoutApproved', 'cornerPlot', 'roadFacilities', 'roadType', 'roadWidth',
             'landLocked', 'water', 'sewerage', 'power']
    for i, key in enumerate(chars):
        cell(d, 1 + i, 6, key)
    cell(d, 19, 6, 'advantage1')
    cell(d, 21, 6, 'specialRemarks')
    for r, key in ((26, 'sizeNorthSouth'), (27, 'sizeEastWest'), (28, 'totalExtent'), (31, 'adoptedRateLine'),
                   (32, 'landValueLine')):
        cell(d, r, 5, key)
    cell(d, 29, 5, '', 'marketRateLine')
    cell(d, 30, 5, '', 'guidelineRateLine')
    e = t[5]
    for r, key in ((2, 'buildingType'), (3, 'constructionType'), (4, 'yearOfConstruction'), (5, 'ageLine'),
                   (6, 'remainingLifeLine'), (7, 'floorsLine')):
        cell(e, r, 3, key)
    cell(e, 10, 2, 'plinthPlan')
    cell(e, 10, 3, 'plinthActual')
    g = t[6]
    cell(g, 1, 2, 'carpetPlan')
    cell(g, 1, 4, 'carpetActual')
    for r, key in ((3, 'conditionExterior'), (4, 'conditionInterior'), (6, 'planAuthority'), (7, 'planVerified'),
                   (8, 'planComments')):
        cell(g, r, 4, key)
    cspan(g, 5, 4, [('1013/0985/B/KAD/cch/2024', 'planNo')], para=0)
    cspan(g, 5, 4, [('28-02-2025', 'planDate')], para=1)
    h = t[7]
    for i, key in enumerate(['foundation', 'basement', 'superstructure', 'joinery', 'rccWorks', 'plastering',
                             'flooring', 'specialFinish', 'roofing', 'drainage']):
        cell(h, 1 + i, 2, f'specGF_{key}')
    for r, key in ((12, 'compoundWall'), (13, 'cwHeight'), (14, 'cwLength'), (15, 'cwType')):
        cell(h, r, 3, key)
    for r, key in ((17, 'wiring'), (18, 'fittingsClass'), (19, 'lightPoints'), (20, 'fanPoints'), (21, 'plugPoints'),
                   (22, 'electricalOther')):
        cell(h, r, 5, key)
    for i, key in enumerate(['waterClosets', 'washBasins', 'urinals', 'bathTubs', 'waterMeter', 'otherFixtures']):
        cell(t[8], 1 + i, 4, key)
    k = t[9]
    for ci, key in ((0, 'fl.sno'), (1, 'fl.label'), (2, 'fl.plinth'), (3, 'fl.height'), (4, 'fl.age'), (5, 'fl.rate'),
                    (6, 'fl.replacement'), (9, 'fl.net')):
        cell(k, 1, ci, key)
    cell(k, 1, 7, 'fl.depPct', 'fl.depAmount')
    k._tbl.remove(k.rows[2]._tr)
    cell(k, 2, 9, 'buildingTotalLine')
    for ti, keys in ((10, ['ex_portico', 'ex_frontDoor', 'ex_sitOut', 'ex_ohTank', 'ex_gates', 'partC']),
                     (11, ['am_wardrobes', 'am_glazedTiles', 'am_sinks', 'am_marble', 'am_interior', 'am_elevation',
                           'am_paneling', 'am_aluminium', 'am_handRails', 'am_falseCeiling', 'partD']),
                     (12, ['mi_toilet', 'mi_lumber', 'mi_sump', 'mi_trees', 'partE']),
                     (13, ['sv_water', 'sv_drainage', 'sv_compoundWall', 'sv_cbDeposits', 'sv_pavement', 'partF'])):
        for r, key in enumerate(keys):
            cell(t[ti], r, 3, key)
    for r, key in enumerate(['absA', 'absB', 'absC', 'absD', 'absE', 'absF', 'absTotal', 'absSayAs']):
        cell(t[14], r, 3, key)
    m = t[15]
    cell(m, 1, 2, 'declBackground')
    cell(m, 2, 2, 'declPurpose')
    cell(m, 5, 2, 'declDates1', 'declDates2', 'declDates3')

    span(doc, 'personally  inspected', '26-05-2026', 'inspectionDate')
    replace_all_body(doc, '27-05-2026', 'reportDate')
    places(doc)
    mark_region(doc, 'Location Map', 'PHOTOS', '{{img:areaMap:5943600:4114800}}')
    mark_images(doc, 'PHOTOS', 'photo', stop_text='GOOGLE - MAP')
    mark_images(doc, 'GOOGLE - MAP', 'gmap')   # two map pictures in the bank's file



def marker_before(doc, contains, marker):
    """Section marker paragraph just before the paragraph containing `contains`."""
    from copy import deepcopy
    from docx.oxml.ns import qn
    from docx.text.paragraph import Paragraph
    p = find_para(doc, contains)
    el = deepcopy(p._p)
    for r in el.findall(qn('w:r')):
        el.remove(r)
    p._p.addprevious(el)
    Paragraph(el, p._parent).add_run(marker)


APT_LOC = [('Semi Finished', 'buildingStatus'), ('(To Be Constructed) ', 'statusNote'), ('Srinivasam Heights', 'aptName'),
           ('404', 'flatNo'), ('Fourth', 'floorName'), ('(As Per Actual ST+FF+SF+TF+FF+FF)', 'actualFloorsNote'),
           ('347/1', 'surveyNo'), ('A-16 & A-17', 'plotNo'), ('Near Rayachoty Road, Prakruthi Nagar', 'locationText'),
           ('Chemmumiahpeta', 'village'), ('Kadapa Municipal Corporation of  Y.S.R (Dt).', 'localBody')]


def loc_spans(doc, locator, pairs, nth=1):
    for old, tag in pairs:
        p = find_para(doc, locator, nth)
        if old in para_text(p):
            replace_span(p, old, T(tag))


# --------------------------------------------------------------------------- APARTMENT
def apartment(doc):
    t = doc.tables
    span(doc, 'FILE NO', '2509125', 'fileNo')
    span(doc, 'District', 'YSR', 'district')
    span(doc, 'Branch    ', 'KADAPA BRANCH', 'bankBranchUpper')
    whole(doc, 'SRINIVASAM HEIGHTS', '“' + T('aptNameUpper') + '” (RESIDENTIAL APARTMENT)')
    whole(doc, 'Stilt + Ground Floor + 4 Upper', T('floorsDesc'))
    whole(doc, 'Constructions”', '“' + T('builderName') + '”')
    whole(doc, 'Ramana Kumar', T('ownerLine1'))
    whole(doc, 'Narasimha reddy', T('ownerLine2'))
    whole(doc, 'Venkata Sathya', T('ownerLine3'))
    whole(doc, '36/256-47-5', T('owner1Addr'))
    span(doc, 'Applicant:--', 'Applicant', 'applicantLabel')
    span_re(doc, 'Lakshmi Prasad', r'Sri A\.Lakshmi Prasad.*', 'applicantLine')
    whole(doc, 'Devuni', T('applicantAddr'))
    span(doc, 'Out of', '5421/2021', 'deedNo')
    span(doc, 'Out of', '1.04 Cents', 'udsCentsLine')
    span(doc, 'Out of', '18.365 Cents', 'parentCentsLine')
    span(doc, '5422/2021', '5422/2021', 'deed2NoOrDash')
    span(doc, 'Survey No :', '347/1', 'surveyNo')
    span(doc, 'Plot No  ', '404', 'flatNo')
    span(doc, 'Plot No  ', 'Fourth', 'floorName')
    span(doc, 'Plot No  ', 'A-16 & A-17', 'plotNo')
    span(doc, 'PLAN APPROVED', '1013/1100/B/KAD/CMPT/2021', 'planNo')
    span(doc, 'PLAN APPROVED', '20-12-2021', 'planDate')
    loc_spans(doc, 'Valuation Report of', APT_LOC, 1)
    span(doc, 'UN DIVIDED SHARE', '50.396', 'udsYd')
    span(doc, 'UN DIVIDED SHARE', '888.88', 'parentYd')
    span(doc, 'Valuation   :', '41,40,000', 'fmv')
    span_re(doc, 'FORTY', r'\(RUPEES.*ONLY \)', '=(' + T('fmvWordsUpper') + ')')
    whole(doc, 'Kadapa Municipal Corporation of  Y.S.R (Dt).', T('localBodyLine'))
    span(doc, 'considered opinion', '41,40,000', 'fmv')
    span(doc, 'Realizable value', '39,33,000', 'realizable')
    span(doc, 'distress value', '37,26,000', 'distress')
    loc_spans(doc, 'JUSTIFICATION', [(o, k) for o, k in APT_LOC if k not in ('buildingStatus', 'statusNote')])

    # Additions estimate page (removed when the case has no proposed additions)
    marker_before(doc, 'Er Gouru', '{{cut:additions}}')
    marker_before(doc, 'Lakshmi Vilas', '{{endcut:additions}}')
    p = find_para(doc, 'ESCALATION ESTIMATE')
    for old, tag in (('347/1', 'surveyNoUpper'), ('A-16 & A-17', 'plotNo'), ('Flat No:404, Fourth Floor, ', 'flatLineUpper'),
                     (' NEAR RAYACHOTY ROAD, PRAKRUTHI NAGAR, CHEMMUMIAHPETA VILLAGE FIELD AT KADAPA MUNICIPAL CORPORATION OF  Y.S.R (DT).', 'locationUpper')):
        replace_span(p, old, T(tag))
    span_re(doc, 'A.Veula', r'Sri A\.Lakshmi Prasad.*', 'applicantLine')       # additions page
    body = list(doc.paragraphs)
    n = 0
    for i, par in enumerate(body):
        tx = para_text(par)
        if tx.strip().startswith(('L.S', 'LS')) and 'Rs' in tx:
            n += 1
            p_span_re(par, r'Rs\s*(\d[\d,]*)', f'ad{n}_amt', group=1)
    span(doc, 'Total                       Rs', '13,00,00', 'adTotal')
    span(doc, 'Rs 13,00,000.00', '13,00,000', 'adTotal')
    span_re(doc, 'THIRTEEN', r'\(RUPEES.*ONLY\)', '=(' + T('adWordsUpper') + ')')

    # Invoice page
    span(doc, 'Kadapa Branch,', 'Kadapa', 'bankBranchShort')
    span_re(doc, 'A.Veula', r'Sri A\.Lakshmi Prasad.*', 'applicantLine')
    loc_spans(doc, 'Valuation Report of', APT_LOC, 2)
    span(doc, 'Valuation  Amount', '41,40,000', 'fmv')
    span(doc, 'Additions Amount', '13,00,000', 'adTotalOrDrop')
    span(doc, 'Fee for Total', '5000', 'fee')

    a = t[0]
    for r, key in ((1, 'purpose'), (2, 'inspectionDate'), (3, 'valuationDate'), (7, 'mvCertificate'),
                   (13, 'villageLine'), (14, 'locationText'), (15, 'localBody'), (17, 'planAuthority'),
                   (18, 'planVerified'), (19, 'planComments'), (20, 'postalAddress'), (21, 'cityTown'),
                   (22, 'areaResidential'), (23, 'areaCommercial'), (24, 'areaIndustrial'), (26, 'areaClass'),
                   (27, 'areaUrban'), (28, 'localBodyType'), (29, 'govtEnactments')):
        cell(a, r, 6, key)
    cspan(a, 5, 6, [('5421/2021', 'deedNo'), ('31-05-2021', 'deedDate')], para=0)
    set_cell_para(a, 5, 6, 1, 'Deed No:- ' + T('deed2No') + ',Dt :-' + T('deed2Date'))
    cspan(a, 6, 6, [('1013/1100/B/KAD/CMPT/2021', 'planNo'), ('20-12-2021', 'planDate')])
    for i, key in enumerate(['owner1Name', 'owner1Rel', 'owner2Name', 'owner2Rel', 'ownerLine3', 'owner1Addr',
                             'blankLine', 'blankLine', 'applicantLabel', 'applicantLine', 'applicantAddr'], start=1):
        set_cell_para(a, 8, 6, i, T(key) + {'applicantLabel': ':--      ', 'owner1Name': '. ', 'owner2Name': '. ',
                                            'owner1Rel': '.', 'owner2Rel': '.'}.get(key, ''))
    cspan(a, 9, 6, [('Srinivasam Heights', 'aptName'), ('404', 'flatNo'), ('4', 'floorNumber'), ('TH', 'floorSuffixUpper')])
    cspan(a, 11, 6, [('A-16 & A-17', 'plotNo')], para=0)
    cspan(a, 11, 6, [('347/1', 'surveyNo')], para=1)
    cspan(a, 12, 6, [('404', 'flatNo'), ('4th', 'floorOrdinal')])
    cspan(a, 16, 6, [('20-12-2021', 'planDate')])
    cspan(a, 30, 1, [('5421/2021', 'deedNo')], para=1)
    cell(a, 30, 6, 'deed2BdHeader')
    cell(a, 35, 1, '=Dimensions (As Per deed: ' + T('deedNo') + ')')
    cell(a, 35, 6, 'deed2DimHeader')
    for r, side in ((31, 'North'), (32, 'South'), (33, 'East'), (34, 'West')):
        cell(a, r, 4, f'bdDeed{side}')
        cell(a, r, 6, f'bd2{side}')
    for r, side in ((36, 'North'), (37, 'South'), (38, 'East'), (39, 'West')):
        cell(a, r, 4, f'dimDeed{side}')
        cell(a, r, 6, f'dim2{side}')
    cell(a, 40, 4, 'deed1ExtentLine')
    cell(a, 40, 6, 'deed2ExtentLine')
    cell(a, 41, 1, 'totalExtentSummary')
    for r, side in ((43, 'North'), (44, 'South'), (45, 'East'), (46, 'West')):
        cell(a, r, 4, f'bdActual{side}')
        cell(a, r, 6, f'dimTotal{side}')
    cell(a, 47, 6, 'parentExtentLine')
    cspan(a, 48, 1, [('404', 'flatNo')], para=1)
    for r, side in ((49, 'North'), (50, 'South'), (51, 'East'), (52, 'West')):
        cell(a, r, 4, f'fbDeed{side}')
        cell(a, r, 6, f'fb{side}')

    b = t[1]
    for r in range(1, 6):
        cell(b, r, 6, '', 'udsOutOf')
        cell(b, r, 8, 'udsOutOf')
    cell(b, 8, 11, '=' + T('latitude') + ', ')
    cell(b, 9, 11, 'longitude')
    for r, key in ((6, 'parentLine2'), (10, 'udsLine'), (11, 'occupancy'), (13, 'aptNature'), (14, 'nearBy'),
                   (15, 'surveyLine'), (16, 'blockNo'), (17, 'wardLine'), (18, 'localBody'), (19, 'flatAddressLine'),
                   (20, 'localityType'), (21, 'yearOfConstruction'), (23, 'structure'), (24, 'unitsLine'),
                   (25, 'quality'), (26, 'appearance'), (27, 'maintenance'), (28, 'facilities'), (29, 'lift'),
                   (30, 'protectedWater'), (31, 'sewerage'), (32, 'carParkingType'), (33, 'compoundWall'),
                   (34, 'pavement'), (36, 'floorLine'), (37, 'flatNoLine'), (39, 'fbNorth'), (40, 'fbSouth'),
                   (41, 'fbEast'), (42, 'fbWest'), (44, 'udsLine'), (45, 'udsLine'), (46, 'udsLine'), (47, 'udsLine'),
                   (49, 'specRoof'), (50, 'specFlooring'), (51, 'specDoors'), (52, 'specWindows'), (53, 'specFittings'),
                   (54, 'specFinishing'), (55, 'houseTax'), (56, 'assessmentNo'), (57, 'taxPaidName'),
                   (58, 'taxAmountLine'), (59, 'electricityNo'), (60, 'meterName'), (61, 'flatMaintenance'),
                   (62, 'deedExecutant'), (63, 'udsCentsLine'), (64, 'plinthLine'), (65, 'fsi'), (66, 'carpetLine'),
                   (67, 'flatClass'), (68, 'usage'), (69, 'occupancy2'), (70, 'monthlyRent'), (72, 'marketability'),
                   (73, 'advantages'), (74, 'negatives'), (76, 'comparableRate'), (77, 'adoptedBasicRate')):
        cell(b, r, 8, key)
    cell(b, 22, 8, 'floorsShort', 'actualFloorsNote')
    cell(b, 79, 8, 'buildingCalc1', 'buildingCalc2')
    cell(b, 80, 8, 'landCalc1', 'landCalc2')
    cell(b, 81, 8, '', 'guidelineNote')
    for r, key in ((84, 'replacementRateLine'), (85, 'ageLine'), (86, 'remainingLifeLine'), (87, 'deprLine'),
                   (88, 'deprValueLine'), (90, 'deprBuildingLine'), (91, 'landValueLine'), (92, 'compositeLine')):
        cell(b, r, 10, key)
    c = t[2]
    cell(c, 1, 2, 'plinthLine')
    cell(c, 1, 3, 'unitRateLine')
    cell(c, 1, 4, 'compositeLine2')
    for r, key in ((2, 'x_wardrobes'), (3, 'x_showcases'), (4, 'x_kitchen'), (5, 'x_superfine'), (6, 'x_interior'),
                   (7, 'x_electrical'), (8, 'x_grills'), (9, 'x_potential'), (10, 'x_others')):
        cell(c, r, 4, key)
    cell(c, 11, 4, 'grandTotalLine', '', 'sayLine')
    g = t[3]
    cell(g, 1, 2, 'declBackground')
    cell(g, 2, 2, 'declPurpose')
    cell(g, 5, 2, 'declDates1', 'declDates2', 'declDates3')

    replace_all_body(doc, '18-09-2025', 'reportDate')
    replace_all_body(doc, '12-09-2025', 'reportDate')
    places(doc)
    mark_region(doc, 'Location Map', 'PHOTOS', '{{img:areaMap:5943600:4114800}}')
    mark_images(doc, 'PHOTOS', 'photo', stop_text='GOOGLE MAP')
    mark_images(doc, 'GOOGLE MAP', 'map')


# --------------------------------------------------------------------------- OPEN SITE
SV1 = '247/1,247/4,248/1,250/6,252/1,255'
SV2 = '257/1,247/3,247/5,250/4,250/7,253/1,256 & 258'


def open_site(doc):
    t = doc.tables
    for _ in range(2):   # report + summary page
        span(doc, '2601070', '2601070', 'fileNo')
        span(doc, 'MAIN BRANCH, KADAPA', 'MAIN BRANCH, KADAPA', 'bankBranchUpper')
        span(doc, 'Main  Branch', 'Main  Branch', 'bankBranchName')
        span(doc, 'Varalakshmi', 'Smt C.Varalakshmi Devi', 'owner1Name')
        span(doc, 'Rama Krishna.', 'W/o Sri M. Rama Krishna', 'owner1Rel')
        span_re(doc, '39/650-2-1', r'D\.NO:.*DT\.', 'owner1Addr')
    span(doc, 'District', 'Y.S.R', 'district')
    span(doc, 'EXTENT', '1045/2022', 'deedNo')
    span(doc, 'EXTENT', '4.50', 'consideredCents')
    span(doc, 'PLOT NO', '125', 'plotNo')
    span(doc, 'PLOT NO', '247/1,247/4,248/1,250/6,252/1,255,', 'surveyNo')
    whole(doc, '57/1,247/3', ' ')
    for nth in (1, 2):
        p = find_para(doc, 'Valuation Report Of', nth)
        tx = para_text(p)
        m = re.search(r'247/1.*?258', tx)
        replace_span(p, m.group(0), T('surveyNo'))
        replace_span(p, '125', T('plotNo'))
        replace_span(p, 'Near Sushanth Motors, Prathap Co-Operative Colony, Buddayapalli, Chinna Chowk', T('locationText'))
        replace_span(p, 'Kadapa Municipal Corporation of Y S R (Dt).', T('localBody'))
    span(doc, 'Valuation:', '63,00,000', 'fmv')
    span_re(doc, 'SIXTY THREE', r'\(RUPEES.*ONLY\)', '=(' + T('fmvWordsUpper') + ')')
    span(doc, 'Fair Market Value Of', '63,00,000', 'fmv')
    span(doc, 'Realizable value', '56,70,000', 'realizable')
    span(doc, 'distress', '50,40,000', 'distress')
    span(doc, 'Govt value', '18,31,200', 'govtValue')
    span(doc, 'JUSTIFICATION', 'Near Nirmala Nursing College, Buddayapalli, Chinna Chowk, Kadapa ', 'justificationPlace')
    whole(doc, 'Proposed Layout Plan is Previously approved', T('layoutNote'))

    a = t[0]
    for r, key in ((1, 'purpose'), (2, 'inspectionDate'), (3, 'valuationDate'), (6, 'layoutPlanLine'), (7, 'planLine'),
                   (8, 'mvCertificate'), (13, 'doorNo'), (14, 'villageLine'), (16, 'localBody'), (17, 'postalAddress'),
                   (18, 'cityTown'), (19, 'areaResidential'), (20, 'areaCommercial'), (21, 'areaIndustrial'),
                   (23, 'areaClass'), (24, 'areaUrban')):
        cell(a, r, 5, key)
    for r, key in ((25, 'localBodyType'), (26, 'govtEnactments'), (27, 'agriConversion')):
        cell(a, r, 6, key)
    cspan(a, 5, 5, [('1045/2022', 'deedNo'), ('03-02-2022', 'deedDate')], para=1)
    set_cell_para(a, 9, 5, 1, T('owner1Name') + ' , ')
    set_cell_para(a, 9, 5, 2, T('owner1Rel') + '.')
    set_cell_para(a, 9, 5, 3, T('owner1Addr'))
    cell(a, 10, 5, 'briefDescription')
    cell(a, 12, 5, 'locationLine')
    cspan(a, 15, 5, [('--', 'wardNo'), ('Buddayapalli', 'landmark')])
    cell(a, 29, 4, '=As Per Deed Plot No:' + T('plotNo'))
    for r, side in ((30, 'North'), (31, 'South'), (32, 'East'), (33, 'West')):
        cell(a, r, 4, f'bdDeed{side}')
        cell(a, r, 6, f'bdActual{side}')
    b = t[1]
    cell(b, 1, 2, '=As Per Deed Plot No:' + T('plotNo'))
    for r, side in ((2, 'North'), (3, 'South'), (4, 'East'), (5, 'West')):
        cell(b, r, 2, f'dimDeed{side}')
        cell(b, r, 3, f'dimActual{side}')
    cell(b, 6, 2, 'extentDeed')
    cell(b, 6, 3, 'extentActual')
    c = t[2]
    cell(c, 0, 3, '=As Per Plan Net Extent     :     ' + T('netExtentPlan'))
    cell(c, 1, 7, 'latitude')
    cell(c, 2, 7, 'longitude')
    for r, key in ((3, 'extentSite'), (4, 'extentConsidered'), (5, 'occupancy')):
        cell(c, r, 6, key)
    chars = ['locality', 'surroundings', 'flooding', 'civicAmenities', 'levelOfLand', 'landShape', 'landUse',
             'usageRestriction', 'layoutApproved', 'cornerPlot', 'roadFacilities', 'roadType', 'roadWidth',
             'landLocked', 'water', 'sewerage', 'power']
    for i, key in enumerate(chars):
        cell(c, 7 + i, 6, key)
    for r, key in ((25, 'advantage1'), (26, 'advantage2'), (27, 'specialRemarks')):
        cell(c, r, 6, key)
    for r, key in ((32, 'extentConsidered'), (33, 'extentConsidered'), (34, 'extentConsidered'),
                   (37, 'adoptedRateLine'), (38, 'landValueLine')):
        cell(c, r, 5, key)
    cell(c, 35, 5, '', 'marketRateLine')
    cell(c, 36, 5, '', 'guidelineRateLine')
    for r, key in ((0, 'absA'), (6, 'absTotal'), (7, 'absSayAs')):
        cell(t[3], r, 3, key)
    g = t[4]
    cell(g, 1, 2, 'declBackground')
    cell(g, 2, 2, 'declPurpose')
    cell(g, 5, 2, 'declDates1', 'declDates2', 'declDates3')

    span(doc, 'personally  inspected', '13-01-2026', 'inspectionDate')
    replace_all_body(doc, '16-01-2026', 'reportDate')
    places(doc)
    mark_region(doc, 'LOCATION MAP', 'PHOTOS', '{{img:areaMap:5943600:4114800}}')
    mark_images(doc, 'PHOTOS', 'photo', stop_text='GOOGLE MAP')
    mark_images(doc, 'GOOGLE MAP', 'gmap')


# --------------------------------------------------------------------------- AGRICULTURE (90% / 80%)
def agriculture(doc):
    t = doc.tables
    span(doc, 'FILE NO', '2501165', 'fileNo')
    span(doc, 'District', 'Y.S.R', 'district')
    span(doc, 'Branch    :', 'PULLUR - BRANCH', 'bankBranchUpper')
    span(doc, 'Pullur Branch', 'Pullur Branch', 'bankBranchName')
    whole(doc, 'Khajipeta (M)', T('branchPlace'))
    span(doc, 'Vijajananda', 'Sri Swamy Vijajananda', 'owner1Name')
    span(doc, 'Rangaiah', 'S/o Sri Rangaiah', 'owner1Rel')
    span_re(doc, 'Kandimallayapalle', r'Kandimallayapalle.*', 'owner1Addr')
    span(doc, 'Deed  No', '255/2017', 'deedNo')
    span(doc, 'Deed  No', '1.44', 'totalAc')
    span(doc, 'Survey No  ', '2165-1(Old No: 2165)', 'surveyNo')
    L = 'Agriculture Land'
    span(doc, L, '2165-1(Old No: 2165)', 'surveyNo')
    span(doc, L, 'Palugurallapalle Part-4 Village, Thotlapalle Panchayath,  B. Mattam Mandal of  Y.S.R  (Dt).', 'locationLine')
    span(doc, 'Twenty Eight', '28,80,000', 'fmv')
    span_re(doc, 'Twenty Eight', r'\(Rupees.*only\)\.', '=(' + T('fmvWords') + ').')
    span(doc, 'Ninety Two', '25,92,000', 'realizable')
    span_re(doc, 'Ninety Two', r'\(Rupees.*only\)\.', '=(' + T('realizableWords') + ').')
    span(doc, 'Twenty Three', '23,04,000', 'distress')
    span_re(doc, T('distress'), r'\(Rupees.*only\)\.', '=(' + T('distressWords') + ').')
    span(doc, '58,400', '1,58,400', 'govtValue')
    tb_span(doc, 'Valuation:', r'28,80,000', 'fmv')
    for box in ('RUPEES', 'TWENTY'):
        try:
            tb_span(doc, box, r'\(RUPEES.*ONLY\)', '(' + T('fmvWordsUpper') + ')')
            break
        except ValueError:
            pass

    a = t[0]
    for r, key in ((1, 'purpose'), (2, 'inspectionDate'), (3, 'valuationDate'), (6, 'planLine'), (7, 'mvCertificate'),
                   (9, 'tenure'), (12, 'doorNo'), (16, 'postalAddress'), (17, 'cityTown'), (18, 'areaResidential'),
                   (19, 'areaCommercial'), (20, 'areaIndustrial'), (21, 'areaAgriculture'), (23, 'areaClass'),
                   (24, 'areaUrban'), (25, 'localBodyType'), (26, 'govtEnactments'), (27, 'agriConversion')):
        cell(a, r, 4, key)
    cspan(a, 5, 4, [('255/2017', 'deedNo'), ('15-02-2017', 'deedDate')])
    set_cell_para(a, 8, 4, 1, T('owner1Name') + ',')
    set_cell_para(a, 8, 4, 2, T('owner1Rel') + '.')
    set_cell_para(a, 8, 4, 3, T('owner1Addr'))
    cspan(a, 11, 4, [('2165-1(Old No: 2165)', 'surveyNo')])
    cell(a, 13, 4, 'villageLine')
    cell(a, 14, 4, 'panchayatLine')
    cell(a, 15, 4, 'mandalLine')
    b = t[1]
    for r, side in ((2, 'North'), (3, 'South'), (4, 'East'), (5, 'West')):
        cell(b, r, 8, f'bdDeed{side}')
        cell(b, r, 9, f'bdActual{side}')
    for r, side in ((7, 'North'), (8, 'South'), (9, 'East'), (10, 'West')):
        cell(b, r, 8, f'dimDeed{side}')
        cell(b, r, 9, f'dimActual{side}')
    cell(b, 11, 3, '=Total Extent: ' + T('extentLine'))
    cell(b, 12, 11, 'latitude')
    cell(b, 13, 11, 'longitude')
    for r, key in ((14, 'extentLine'), (15, 'extentLine'), (16, 'occupancy')):
        cell(b, r, 9, key)
    chars = ['locality', 'surroundings', 'flooding', 'civicAmenities', 'levelOfLand', 'landShape', 'landUse',
             'usageRestriction', 'layoutApproved', 'cornerPlot', 'roadFacilities', 'roadType', 'roadWidth',
             'landLocked', 'water', 'sewerage', 'power']
    for i, key in enumerate(chars):
        cell(b, 18 + i, 9, key)
    cell(b, 36, 9, 'advantage1')
    cell(b, 38, 9, 'specialRemarks')
    for r, key in ((43, 'extentLine'), (45, 'extentLine'), (47, 'guidelineRateLine'), (48, 'adoptedRateLine'),
                   (49, 'landValueLine')):
        cell(b, r, 8, key)
    cell(b, 46, 8, '', 'marketRateLine')
    cell(t[8], 0, 3, 'absA')
    cell(t[8], 6, 3, 'absTotal')
    g = t[9]
    cell(g, 1, 2, 'declBackground')
    cell(g, 2, 2, 'declPurpose')
    cell(g, 5, 2, 'declDates1', 'declDates2', 'declDates3')

    span(doc, 'personally  inspected', '08-01-2025', 'inspectionDate')
    replace_all_body(doc, '09-01-2025', 'reportDate')
    places(doc)
    mark_region(doc, 'LOCATION MAP', 'Photos', '{{img:areaMap:5943600:4114800}}')
    mark_images(doc, 'Photos', 'photo', stop_text='Google  Map')
    mark_images(doc, 'Google  Map', 'gmap')


FORMATS = {'house': house, 'apartment': apartment, 'open_site': open_site, 'agriculture': agriculture}

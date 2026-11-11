"""
Bank of Baroda: fill-in templates from the bank's own sample reports (bob_source/*.docx).

Run:  python3 make_templates.py bob [house|apartment|open_site|agriculture]
Only the sample values are swapped for {{tags}}; the letterhead, tables, fonts, colours and
fixed wording stay exactly as the bank's file.
"""
from docx.oxml.ns import qn
from docx_tools import replace_span, find_para, para_text, textbox_paragraphs
from make_templates import (T, span, span_re, whole, cell, cspan, set_cell_para, mark_region, mark_images,
                            replace_all_body, _drop_tabs)


def places(doc):
    """'Place : Kadapa' / 'Place : KADAPA' lines → the valuer's place."""
    for p in doc.paragraphs:
        tx = para_text(p)
        if 'Place' not in tx:
            continue
        if 'KADAPA' in tx:
            replace_span(p, 'KADAPA', T('placeUpper'))
        elif 'Kadapa' in tx:
            replace_span(p, 'Kadapa', T('place'))


def tb_span(doc, contains, pattern, tag):
    """Replace text inside text boxes (Word keeps two copies of each box; both are changed)."""
    import re
    n = 0
    for p in textbox_paragraphs(doc):
        tx = para_text(p)
        if contains in tx:
            m = re.search(pattern, tx)
            if m and replace_span(p, m.group(0), tag if tag.startswith('{{') or tag.startswith('(') else T(tag)):
                n += 1
    if not n:
        raise ValueError(f'text box with {contains!r} not found')


def rename_image(doc, old_prefix, new_name):
    """The last photo slot is really the map (no heading between them in the bank's file)."""
    for t in doc.element.body.iter(qn('w:t')):
        if t.text and t.text.startswith('{{img:' + old_prefix):
            last = t
    last.text = '{{img:' + new_name + last.text[last.text.index(':', 6):]


# --------------------------------------------------------------------------- HOUSE
def house(doc):
    t = doc.tables
    span(doc, 'FILE NO', '2605081', 'fileNo')
    _drop_tabs(find_para(doc, 'FILE NO'), 2)
    span(doc, 'District   :', 'Y.S.R', 'district')
    span(doc, 'Branch  :', 'RS ROAD BRANCH – KADAPA', 'bankBranchUpper')

    # Owners (up to two) and the applicant — unused lines disappear
    span(doc, 'Khasim', 'Sri S. Khasim Peera', 'owner1Name')
    span(doc, 'Abdul Khader', 'S/o. Sri. S. Abdul Khader', 'owner1Rel')
    span_re(doc, 'Ravindra Nagar', r'Door No : .*\(Dt\)\.', 'owner1Addr')
    span(doc, 'Khader Basha', 'Sri S. Khader Basha', 'owner2Name')
    span(doc, 'Abdul Khader', 'S/o. Sri. S. Abdul Khader', 'owner2Rel')
    span_re(doc, 'Sastri', r'Door No : .*\(Dt\)\.', 'owner2Addr')
    span(doc, 'Applicant :-', 'Applicant', 'applicantLabel')
    span(doc, 'Divya', 'Smt G. Divya Prabhakar Reddy', 'applicantName')
    span(doc, 'Prabhakar Reddy', 'D/o. Sri. G. Prabhakar Reddy', 'applicantRel')
    span_re(doc, 'Nallasopara', r'Door No : .*State\.', 'applicantAddr')

    span(doc, 'Net Extent', '5911/2025', 'deedNo')
    span(doc, 'Net Extent', '2.59', 'netExtentCents')
    span(doc, '44/28-1-16', '44/28-1-16', 'doorNo')     # first: the 'Door No / Survey No' line
    span(doc, '497/2C', '497/2C', 'surveyNo')
    span(doc, 'Plan Approved Under', 'PER/1013/0326/2026', 'planNo')
    span(doc, 'Plan Approved Under', '12-05-2026', 'planDate')
    L = 'Valuation Report Of'
    span(doc, L, 'Residential Building (GF)', 'buildingDesc')
    span(doc, L, '497/2C', 'surveyNo')
    span(doc, L, '44/28-1-16', 'doorNo')
    span(doc, L, '44', 'wardNo')
    span(doc, L, 'Vijay Nagar Colony', 'landmark')
    span(doc, L, 'Chemmumaiahpeta', 'village')
    span(doc, L, 'Kadapa Municipal Corporation Of  Y.S.R. (Dt).', 'localBody')
    span(doc, 'Valuation   :', '57,35,000', 'fmv')
    span_re(doc, 'FIFTY SEVEN', r'\(RUPEES.*ONLY\)', '=(' + T('fmvWordsUpper') + ')')
    span_re(doc, 'Kadapa Municipal Corporation of Y.S.R (', r'Kadapa.*', 'localBodyLine')
    span(doc, 'Justification', 'Vijaynagar Colony', 'landmark')
    span(doc, 'Justification', 'Chemmumaiahpeta', 'village')
    span(doc, 'Fair Market Value Of Above', '57,35,000', 'fmv')
    span(doc, 'Realizable value of the above', '51,60,000', 'realizable')
    span(doc, 'distress Value of the above', '45,90,000', 'distress')

    a = t[0]
    for r, key in ((1, 'purpose'), (2, 'inspectionDate'), (3, 'valuationDate'), (7, 'mvCertificate'),
                   (16, 'postalAddress'), (17, 'cityTown'), (18, 'areaResidential'), (19, 'areaCommercial'),
                   (20, 'areaIndustrial'), (22, 'areaClass'), (23, 'areaUrban'), (45, 'netExtentPlan'),
                   (46, 'extentConsidered'), (47, 'occupancy'), (67, 'advantage1'), (68, 'specialRemarks')):
        cell(a, r, 11, key)
    cspan(a, 5, 11, [('5911/2025', 'deedNo'), ('02-08-2025', 'deedDate')], para=1)
    cspan(a, 6, 11, [('PER/1013/0326/2026', 'planNo')], para=0)
    cspan(a, 6, 11, [('12-05-2026', 'planDate')], para=1)
    for i, key in enumerate(['owner1Name', 'owner1Rel', 'owner1Addr', 'owner2Name', 'owner2Rel', 'owner2Addr',
                             'applicantLabel', 'applicantName', 'applicantRel', 'applicantAddr'], start=1):
        suffix = {'owner1Name': ', ', 'owner2Name': ', ', 'applicantName': ', ', 'owner1Rel': '.', 'owner2Rel': '.',
                  'applicantRel': '.', 'applicantLabel': ' :-  '}.get(key, '')
        set_cell_para(a, 8, 11, i, T(key) + suffix)
    LOC = [('497/2C', 'surveyNo'), ('44/28-1-16', 'doorNo'), ('44', 'wardNo'), ('Vijay Nagar Colony', 'landmark'),
           ('Chemmumaiahpeta', 'village'), ('Kadapa Municipal Corporation Of  Y.S.R. (Dt).', 'localBody')]
    cspan(a, 9, 11, [('Building', 'buildingKind')] + LOC)
    cspan(a, 11, 11, [('497/2C', 'surveyNo')])
    cspan(a, 12, 11, [('44/28-1-16', 'doorNo')])
    cspan(a, 13, 11, [('Chemmumaiahepta', 'village')])
    cspan(a, 14, 11, [('44', 'wardNo'), ('Vijay Nagar Colony', 'landmark')])
    for r in (15, 24):
        cspan(a, r, 11, [('Kadapa Municipal Corporation', 'localBodyName')], para=0)
        set_cell_para(a, r, 11, 1, T('district') + ' (Dt).')
    cell(a, 25, 12, 'govtEnactments')
    cell(a, 26, 12, 'agriConversion')
    for r, side in ((29, 'North'), (30, 'South'), (31, 'East'), (32, 'West')):
        cell(a, r, 10, f'bdDeed{side}')
        cell(a, r, 12, f'bdActual{side}')
    for r, side in ((35, 'North'), (36, 'South'), (37, 'East'), (38, 'West')):
        cell(a, r, 10, f'dimDeed{side}')
        cell(a, r, 12, f'dimActual{side}')
    cell(a, 39, 10, 'extentDeed')
    cell(a, 39, 12, 'extentActual')
    cell(a, 40, 4, '=Total Extent : ' + T('extentDeed'))
    cell(a, 41, 4, '=As per Plan Net Extent : ' + T('netExtentPlan'))
    cell(a, 42, 13, 'gpsDms', 'gpsDecimal')   # one merged box for Latitude and Longitude
    cell(a, 44, 11, 'extentSite')
    chars = ['locality', 'surroundings', 'flooding', 'civicAmenities', 'levelOfLand', 'landShape', 'landUse',
             'usageRestriction', 'layoutApproved', 'cornerPlot', 'roadFacilities', 'roadType', 'roadWidth',
             'landLocked', 'water', 'sewerage', 'power']
    for i, key in enumerate(chars):
        cell(a, 49 + i, 11, key)
    for r, key in ((71, 'sizeNorthSouth'), (72, 'sizeEastWest'), (73, 'totalExtent'), (74, 'netExtentPlan'),
                   (76, 'guidelineRateLine'), (77, 'adoptedRateLine'), (78, 'landValueLine')):
        cell(a, r, 10, key)
    cell(a, 75, 10, '', 'marketRateLine')

    b = t[1]
    for r, key in ((2, 'buildingType'), (3, 'constructionType'), (4, 'yearOfConstruction'), (5, 'ageLine'),
                   (6, 'remainingLifeLine'), (7, 'floorsLine'), (13, 'conditionExterior'), (14, 'conditionInterior'),
                   (16, 'planAuthority'), (17, 'planVerified'), (18, 'planComments')):
        cell(b, r, 4, key)
    cell(b, 10, 2, 'plinthPlan')
    cell(b, 10, 4, 'plinthActual')
    cell(b, 11, 2, '=Carpet Area :', 'carpetPlan')
    cell(b, 11, 4, '=Carpet Area :', 'carpetActual')
    cspan(b, 15, 4, [('PER/1013/0326/2026', 'planNo')], para=0)
    cspan(b, 15, 4, [('12-05-2026', 'planDate')], para=1)

    c = t[2]
    specs = ['foundation', 'basement', 'superstructure', 'joinery', 'rccWorks', 'plastering', 'flooring',
             'specialFinish', 'roofing', 'drainage']
    for i, key in enumerate(specs):
        cell(c, 1 + i, 4, f'specGF_{key}')
    for r, key in ((12, 'compoundWall'), (13, 'cwHeight'), (14, 'cwLength'), (15, 'cwType'), (17, 'wiring'),
                   (18, 'fittingsClass'), (19, 'lightPoints'), (20, 'fanPoints'), (21, 'plugPoints'),
                   (22, 'electricalOther')):
        cell(c, r, 7, key)
    for r, key in ((24, 'waterClosets'), (25, 'washBasins'), (26, 'urinals'), (27, 'bathTubs'),
                   (28, 'waterMeter'), (29, 'otherFixtures')):
        cell(c, r, 6, key)

    # Building table: one row per floor
    e = t[3]
    row = e.rows[1]
    for ci, key in ((0, 'fl.sno'), (1, 'fl.label'), (2, 'fl.plinth'), (3, 'fl.height'), (4, 'fl.age'),
                    (5, 'fl.rate'), (6, 'fl.replacement'), (8, 'fl.net')):
        cell(e, 1, ci, key)
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

    span(doc, 'personally inspected', '19-05-2026', 'inspectionDate')
    replace_all_body(doc, '19-05-2026', 'reportDate')
    places(doc)

    whole(doc, '14°27', T('gpsDms'))
    whole(doc, '14.462533, 78.811922', T('gpsDecimal'))
    mark_region(doc, 'Location Map', 'PHOTO’S:', '{{img:areaMap:5943600:4114800}}')
    mark_images(doc, 'PHOTO’S:', 'photo', stop_text='14°')
    rename_image(doc, 'photo', 'map1')


# --------------------------------------------------------------------------- APARTMENT
def apartment(doc):
    t = doc.tables
    span(doc, 'FILE NO', '2605028', 'fileNo')
    _drop_tabs(find_para(doc, 'FILE NO'), 2)
    span(doc, 'District   :', 'Y.S.R', 'district')
    span(doc, 'Branch  :', 'HOSPITAL ROAD BRANCH', 'bankBranchUpper')
    span(doc, 'Lakshmi Elite”', 'Sri Lakshmi Elite', 'aptName')
    whole(doc, 'Stilt + Ground Floor + 4 Upper Floors', T('floorsDesc'))
    span(doc, 'Balakrishna', 'Sri  S. Balakrishna', 'owner1Name')
    span(doc, 'Gangi', 'S/o SRI S. Gangi Reddy', 'owner1Rel')
    whole(doc, 'Flat No : 203, Second Floor', T('owner1Addr'))
    L = 'Out Of'
    span(doc, L, '9625/2007', 'deedNo')
    span(doc, L, '33.00 Sqyds', 'udsShort')
    span(doc, L, '709.28', 'parentSqyd')
    L = '91/1 & 752/2'
    span(doc, L, '203', 'flatNo')
    span(doc, L, '2nd', 'floorOrdinal')
    span(doc, L, '91/1 & 752/2', 'surveyNo')
    span(doc, 'Plan', '224/G1/2007', 'planNo')
    span(doc, T('planNo'), '20-07-2007', 'planDate')
    L = 'Valuation Report'
    span(doc, L, 'Sri Lakshmi Elite', 'aptName')
    span(doc, L, '203', 'flatNo')
    span(doc, L, 'Second', 'floorName')
    span(doc, L, '91/1 & 752/2', 'surveyNo')
    span(doc, L, '42/514-18', 'doorNo')
    span(doc, L, 'Co-Operative Colony', 'landmark')
    span(doc, L, ' Jaya Nagar Colony,', 'areaNameComma')
    span(doc, L, 'Chinnachowk', 'village')
    span(doc, L, 'Kadapa Municipal Corporation of  Y.S.R(Dt).', 'localBody')
    span(doc, 'UN DIVIDED SHARE', '33.00 Sqyds', 'udsShort')
    span(doc, 'UN DIVIDED SHARE', '709.28 Sqyds', 'parentSqydLine')
    span(doc, 'Valuation', '30,85,000', 'fmv', nth=1) if False else span(doc, 'Valuation Rs', '30,85,000', 'fmv')
    span_re(doc, 'THIRTY LAKHS', r'\( RUPEES.*ONLY \)', '=( ' + T('fmvWordsUpper') + ' )')
    span_re(doc, 'KADAPA MUNICIPAL CORPORATION', r'KADAPA.*', 'localBodyUpper')
    span(doc, 'Justification', 'Co-Operative colony', 'landmark')
    span(doc, 'Justification', 'Chinnachowk', 'village')
    span(doc, 'Justification', 'East', 'roadFacing')
    L = 'considered opinion'
    span(doc, L, '30,85,000', 'fmv')
    span_re(doc, L, r'\(Rs .*only\)\.', '=(' + T('fmvWords') + ').')
    span(doc, 'Realizable value', '27,80,000', 'realizable')
    span_re(doc, 'Realizable value', r'\(Rupees .*only\)\.', '=(' + T('realizableWords') + ').')
    span(doc, 'distress value Rs', '24,70,000', 'distress')
    span_re(doc, 'distress value Rs', r'\(Rupees .*only\)\.', '=(' + T('distressWords') + ').')
    # Invoice page
    whole(doc, 'Hospital Road Branch, Kadapa.', T('bankBranchLine'))
    span(doc, 'Fee For', '5,000', 'fee')
    span_re(doc, 'Five', r'\(Rupees .*Only\)', '=(' + T('feeWords') + ')')

    a = t[0]
    for r, key in ((1, 'purpose'), (2, 'inspectionDate'), (3, 'valuationDate'), (7, 'mvCertificate'),
                   (13, 'villageLine'), (15, 'mandalDistrict'), (17, 'planAuthority'), (18, 'planVerified'),
                   (19, 'planComments'), (20, 'postalAddress'), (21, 'cityTown'), (22, 'areaResidential'),
                   (23, 'areaCommercial'), (24, 'areaIndustrial'), (26, 'areaClass'), (27, 'areaUrban'),
                   (28, 'localBodyType'), (29, 'govtEnactments'), (43, 'netSitePlan'), (46, 'udsLine'),
                   (47, 'occupancy'), (49, 'aptNature'), (50, 'aptLocation'), (51, 'surveyLine'), (52, 'blockNo'),
                   (53, 'wardLine'), (54, 'localBodyLine'), (55, 'doorLine'), (56, 'localityType'),
                   (57, 'yearOfConstruction'), (58, 'floorsShort'), (59, 'structure'), (60, 'unitsLine'),
                   (61, 'quality'), (62, 'appearance'), (63, 'maintenance'), (64, 'facilities'), (65, 'lift'),
                   (66, 'protectedWater'), (67, 'sewerage'), (68, 'carParkingType'), (69, 'compoundWall'),
                   (70, 'pavement'), (72, 'floorLine'), (75, 'fbNorth'), (76, 'fbSouth'), (77, 'fbEast'),
                   (78, 'fbWest'), (85, 'specRoof'), (86, 'specFlooring'), (87, 'specDoors'), (88, 'specWindows'),
                   (89, 'specFittings'), (90, 'specFinishing'), (91, 'houseTax'), (92, 'assessmentNo'),
                   (93, 'taxPaidName'), (94, 'taxAmountLine'), (95, 'electricityNo'), (96, 'meterName'),
                   (97, 'flatMaintenance'), (99, 'udsShort'), (100, 'plinthLine'), (101, 'fsi'), (102, 'carpetLine'),
                   (103, 'flatClass'), (104, 'usage'), (105, 'occupancy2'), (106, 'monthlyRent'),
                   (108, 'marketability'), (109, 'advantages'), (110, 'negatives'), (112, 'comparableRate'),
                   (113, 'adoptedBasicRate')):
        cell(a, r, 9, key)
    cspan(a, 5, 9, [('9625/2007', 'deedNo'), ('01-11-2007', 'deedDate')])
    cspan(a, 6, 9, [('B.A.NO: 224/G1/2007, Dt: 20-07-2007', 'planLine')])
    set_cell_para(a, 8, 9, 1, T('owner1Name') + ', ')
    set_cell_para(a, 8, 9, 2, T('owner1Rel') + '.')
    set_cell_para(a, 8, 9, 3, T('owner1Addr'))
    cspan(a, 9, 9, [('203', 'flatNo'), ('SECOND', 'floorNameUpper')])
    cspan(a, 11, 9, [('91/1 & 752/2', 'surveyNo')])
    cspan(a, 12, 9, [('42/514-18', 'doorNo'), ('203', 'flatNo'), ('2ND', 'floorOrdinalUpper')])
    cspan(a, 14, 9, [('Co-Operative Colony', 'landmark')])
    cspan(a, 16, 9, [('20-07-2007', 'planDate')])
    for r, side in ((32, 'North'), (33, 'South'), (34, 'East'), (35, 'West')):
        cell(a, r, 5, f'bdDeed{side}')
        cell(a, r, 11, f'bdActual{side}')
    for r, side in ((38, 'North'), (39, 'South'), (40, 'East'), (41, 'West')):
        cell(a, r, 7, f'dimDeed{side}')
        cell(a, r, 10, f'dimActual{side}')
    cell(a, 42, 7, 'parentExtentLine')
    cell(a, 42, 10, 'parentExtentLine')
    cell(a, 44, 12, 'latitudeLine')
    cell(a, 45, 12, 'longitudeLine')
    cspan(a, 73, 9, [('203', 'flatNo'), ('42/514-18', 'doorNo')])
    for r in (80, 81, 82, 83):
        cell(a, r, 9, 'udsDims')
    cell(a, 98, 9, 'deedExecutant', 'deedExecutantRelation')

    b = t[1]
    for r, key in ((1, 'buildingCalc'), (2, 'landCalc'), (3, 'guidelineNote'), (6, 'replacementLine'),
                   (7, 'ageLine'), (8, 'remainingLifeLine'), (9, 'deprLine'), (10, 'deprValueLine'),
                   (12, 'deprBuildingLine'), (13, 'landValueLine'), (14, 'compositeLine')):
        cell(b, r, 4, key)

    c = t[2]
    cell(c, 1, 2, 'plinthLine')
    cell(c, 1, 3, 'unitRateLine')
    cell(c, 1, 4, 'compositeLine2')
    for r, key in ((2, 'x_wardrobes'), (3, 'x_showcases'), (4, 'x_kitchen'), (5, 'x_superfine'), (6, 'x_interior'),
                   (7, 'x_electrical'), (8, 'x_grills'), (9, 'x_potential'), (10, 'x_others')):
        cell(c, r, 4, key)
    cell(c, 11, 4, 'grandTotalLine', 'sayLine')

    g = t[3]
    cell(g, 1, 2, 'declBackground', 'declBuilding')
    cell(g, 2, 2, 'declPurpose')
    cell(g, 5, 2, 'declDates1', 'declDates2', 'declDates3')

    h = t[4]
    cell(h, 1, 1, 'owner1NameLine', 'owner1RelLine')
    cell(h, 1, 2, '=Rs ' + T('fmv') + '/-')
    cell(h, 1, 3, '=Rs ' + T('fee') + '/-')
    cell(h, 2, 3, '=Rs ' + T('fee') + '/-')

    span(doc, 'personally inspected', '07-05-2026', 'inspectionDate')
    replace_all_body(doc, '07-05-2026', 'reportDate')
    places(doc)
    mark_region(doc, 'Location Map', 'PHOTO-GRAPHS', '{{img:areaMap:5943600:4114800}}')
    mark_images(doc, 'PHOTO-GRAPHS', 'photo', stop_text='Gouru')
    rename_image(doc, 'photo', 'map1')


# --------------------------------------------------------------------------- OPEN SITE (one or two deeds)
def open_site(doc):
    t = doc.tables
    span(doc, 'FILE NO', '2605030', 'fileNo')
    _drop_tabs(find_para(doc, 'FILE NO'), 2)
    span(doc, 'District   :', 'Y.S.R', 'district')
    span(doc, 'Branch  :', 'HOSPTAL ROAD BRANCH – KADAPA', 'bankBranchUpper')
    span(doc, 'Radha Devi', 'Smt. B. Radha Devi', 'owner1Name')
    span(doc, 'Kishore Kumar', 'W/o. Sri. B. Kishore Kumar Reddy', 'owner1Rel')
    span_re(doc, 'Gangireddypalli', r'Door No : .*\(Dt\)\.', 'owner1Addr')
    span(doc, '573/2025', '573/2025', 'deedNo')
    span(doc, '5.234 Cents', '5.234', 'deed1Cents')
    span(doc, '574/2025', '574/2025', 'deed2No')
    span(doc, '5.757 Cents', '5.757', 'deed2Cents')
    span(doc, 'Total Extent', '10.991', 'totalCents')
    span(doc, 'Plot No', '46, 47', 'plotNo')
    span(doc, 'Plot No', '50-2B', 'surveyNo')
    LOC = 'Thollaganganapalle Village, Thollagangapalle Grama Panchayath, Near Vedas Public School, Kadapa To Tadipathri High Way'
    L = 'Valuation Report of'
    span(doc, L, 'Residential Vacant Site', 'siteType')
    span(doc, L, '50-2B', 'surveyNo')
    span(doc, L, '46, 47', 'plotNo')
    span(doc, L, LOC, 'locationText')
    span(doc, L, 'Thollaganganapalle', 'village')
    span(doc, L, 'Valluru Mandal Of Y.S.R. (Dt).', 'localBody')
    span(doc, 'Valuation :', '43,96,000', 'fmv')
    span_re(doc, 'FOURTY THREE', r'\(RUPEES.*ONLY\)', '=(' + T('fmvWordsUpper') + ')')
    span_re(doc, 'Valluru Mandal of', r'Valluru.*', 'localBodyLine')
    span(doc, 'Fair Market Value Of Above', '43,96,000', 'fmv')
    span(doc, 'Realizable value of the above', '39,60,000', 'realizable')
    span(doc, 'distress Value of the above', '35,20,000', 'distress')

    a = t[0]
    for r, key in ((1, 'purpose'), (2, 'inspectionDate'), (3, 'valuationDate'), (6, 'planLine'), (7, 'mvCertificate'),
                   (16, 'postalAddress'), (17, 'cityTown'), (18, 'areaResidential'), (19, 'areaCommercial'),
                   (20, 'areaIndustrial')):
        cell(a, r, 6, key)
    cspan(a, 5, 6, [('573/2025', 'deedNo'), ('24-01-2025', 'deedDate')], para=1)
    cspan(a, 5, 6, [('574/2025', 'deed2No'), ('24-01-2025', 'deed2Date')], para=2)
    set_cell_para(a, 8, 6, 1, T('owner1Name') + ', ')
    set_cell_para(a, 8, 6, 2, T('owner1Rel') + '.')
    set_cell_para(a, 8, 6, 3, T('owner1Addr'))
    cspan(a, 9, 6, [('50-2B', 'surveyNo'), ('46, 47', 'plotNo'), (LOC, 'locationText'), ('Thollaganganapalle', 'village'),
                    ('Valluru Mandal Of Y.S.R. (Dt).', 'localBody')])
    cspan(a, 11, 6, [('50-2B', 'surveyNo')])
    cspan(a, 12, 6, [('46, 47', 'plotNo')])
    cspan(a, 13, 6, [('Thollaganganapalle', 'village')])
    cell(a, 14, 6, '=In ' + T('locationText') + ',')
    cell(a, 15, 6, 'localBody')

    b = t[1]
    for r, key in ((1, 'areaClass'), (2, 'areaUrban'), (3, 'localBodyType')):
        cell(b, r, 10, key)
    cell(b, 4, 11, 'govtEnactments')
    cell(b, 5, 11, 'agriConversion')
    cell(b, 7, 7, 'deed1Header')
    cell(b, 7, 11, 'deed2Header')
    cell(b, 18, 7, 'deed1Header')
    cell(b, 18, 11, 'deed2Header')
    for r, side in ((8, 'North'), (9, 'South'), (10, 'East'), (11, 'West')):
        cell(b, r, 7, f'bdDeed{side}')
        cell(b, r, 11, f'bd2{side}')
    for r, side in ((13, 'North'), (14, 'South'), (15, 'East'), (16, 'West')):
        cell(b, r, 7, f'bdActual{side}')
    for r, side in ((19, 'North'), (20, 'South'), (21, 'South'), (22, 'East'), (23, 'West')):
        cell(b, r, 7, f'dimDeed{side}')
        if r != 20:
            cell(b, r, 11, f'dim2{side}')
    cell(b, 24, 7, 'deed1ExtentLine')
    cell(b, 24, 11, 'deed2ExtentLine')
    for r, side in ((26, 'North'), (27, 'South'), (28, 'East'), (29, 'West')):
        cell(b, r, 7, f'dimTotal{side}')
    cell(b, 30, 7, 'totalExtentLine')
    cell(b, 31, 4, '=As Per Plan Net Extent : ' + T('netExtentPlan'))
    cell(b, 32, 12, 'gpsDms', 'gpsDecimal')
    for r, key in ((34, 'totalExtentLine'), (35, 'extentConsidered'), (36, 'occupancy')):
        cell(b, r, 9, key)
    chars = ['locality', 'surroundings', 'flooding', 'civicAmenities', 'levelOfLand', 'landShape', 'landUse',
             'usageRestriction', 'layoutApproved', 'cornerPlot', 'roadFacilities', 'roadType', 'roadWidth',
             'yearOfConstruction', 'ageLine', 'remainingLifeLine', 'landLocked', 'water', 'sewerage', 'power']
    for i, key in enumerate(chars):
        cell(b, 38 + i, 8, key)
    cell(b, 59, 8, 'advantage1')
    cell(b, 60, 8, 'specialRemarks')
    for r, key in ((63, 'totalExtentLine'), (64, 'totalExtentLine'), (65, 'totalExtentLine'), (66, 'extentConsidered'),
                   (69, 'adoptedRateLine'), (70, 'landValueLine')):
        cell(b, r, 7, key)
    cell(b, 67, 7, '', 'marketRateLine')
    cell(b, 68, 7, '', 'guidelineRateLine')

    for r, key in ((0, 'absA'), (6, 'absTotal'), (7, 'absSayAs')):
        cell(t[2], r, 3, key)
    g = t[3]
    cell(g, 1, 2, 'declBackground')
    cell(g, 2, 2, 'declPurpose')
    cell(g, 5, 2, 'declDates1', 'declDates2', 'declDates3')

    span(doc, 'personally inspected', '08-05-2026', 'inspectionDate')
    replace_all_body(doc, '08-05-2026', 'reportDate')
    places(doc)
    whole(doc, '14°32', T('gpsDms'))
    whole(doc, '14.533639, 78.755083', T('gpsDecimal'))
    mark_region(doc, 'LOCATION MAP', 'PHOTOS', '{{img:areaMap:5943600:4114800}}')
    mark_images(doc, 'PHOTOS', 'photo', stop_text='GOOGLE MAP')
    mark_images(doc, 'GOOGLE MAP', 'map')


# --------------------------------------------------------------------------- AGRICULTURE (several land items)
def agriculture(doc):
    t = doc.tables
    span(doc, 'FILE NO', '2502023', 'fileNo')
    _drop_tabs(find_para(doc, 'FILE NO'), 2)
    span(doc, 'District   :', 'Y.S.R', 'district')
    span(doc, 'Branch  :', 'RS ROAD BRANCH – KADAPA', 'bankBranchUpper')
    span(doc, 'Sandhya', 'Smt Y. Sandhya', 'owner1Name')
    span(doc, 'Ramana', 'W/o  Sri  Y. Venkata Ramana', 'owner1Rel')
    span_re(doc, 'Venkatapuram Village, Mydukuru', r'Door No :.*\)\.', 'owner1Addr')
    span(doc, 'Total Extent', '372/2018', 'deedNo')
    span(doc, 'Total Extent', '1.29', 'totalAc')
    span(doc, 'Survey No    :', '1788, 1739, 1740, 1871', 'surveyNo')
    span(doc, 'Khata No    ', '2003', 'khathaNo')
    L = 'Valuation Report of'
    span(doc, L, '1788, 1739, 1740, 1871', 'surveyNo')
    span(doc, L, '2003', 'khathaNo')
    span(doc, L, 'Venkatapuram', 'landmark')
    span(doc, L, 'S. Mydukuru', 'village')
    span(doc, L, 'Mydukuru Mandal of Y.S.R (Dt).', 'localBody')
    tb_span(doc, 'Valuation :', r'19,35,000', 'fmv')
    tb_span(doc, 'NINTEEN', r'\(RUPEES.*ONLY\)', '(' + T('fmvWordsUpper') + ')')
    span(doc, 'Fair Market Value Of Above', '19,35,000', 'fmv')
    span(doc, 'Realizable value of the above', '17,40,000', 'realizable')
    span(doc, 'distress Value of the above', '15,50,000', 'distress')

    a = t[0]
    for r, key in ((1, 'purpose'), (2, 'inspectionDate'), (3, 'valuationDate'), (5, 'pattaPassbook'), (6, 'deedNo'),
                   (7, 'mvCertificate'), (12, 'doorNo'), (16, 'postalAddress')):
        cell(a, r, 4, key)
    set_cell_para(a, 8, 4, 1, T('owner1Name') + ', ')
    set_cell_para(a, 8, 4, 2, T('owner1Rel') + '.')
    set_cell_para(a, 8, 4, 3, T('owner1Addr'))
    cspan(a, 11, 4, [('1788, 1739, 1740, 1871', 'surveyNo')])
    cspan(a, 13, 4, [('S. Mydukuru', 'village')])
    cspan(a, 14, 4, [('Venkatapuram', 'landmark')])
    cspan(a, 15, 4, [('Mydukuru', 'mandal'), ('Y.S.R', 'district')])
    for r, key in ((17, 'localBodyType'), (18, 'govtEnactments'), (19, 'agriConversion')):
        cell(a, r, 5, key)

    # Item 1 (its own table)
    b = t[1]
    for r, side in ((2, 'North'), (3, 'South'), (4, 'East'), (5, 'West')):
        cell(b, r, 2, f'it1{side}')
    cell(b, 2, 3, '', '=Survey No : ' + T('it1Survey') + ',', '=Extent : Ac ' + T('it1Extent') + ' Cents')

    # Items 2, 3 … : one block copied per item
    c = t[2]
    cell(c, 0, 0, '=13' + T('ag.blank'))
    cell(c, 1, 3, '=As Per Deed, Item.' + T('ag.no'))
    for r, side in ((2, 'north'), (3, 'south'), (4, 'east'), (5, 'west')):
        cell(c, r, 4, f'ag.{side}')
    cell(c, 2, 6, '', '=Survey No : ' + T('ag.survey') + ', ', '=Extent : Ac ' + T('ag.extent') + ' Cents')
    cell(c, 18, 3, '=Total Site :- Ac ' + T('totalAc') + ' Cent')
    cell(c, 19, 7, 'gpsDms', 'gpsDecimal')
    for r, key in ((21, 'extentLine'), (22, 'extentLine'), (23, 'extentLine'), (24, 'occupancy'), (25, 'income'),
                   (28, 'irrigation'), (29, 'flooding'), (30, 'levelOfLand'), (31, 'landLocked'), (32, 'cottages'),
                   (33, 'fencing'), (34, 'generalCondition'), (35, 'soilQuality'), (36, 'onHighway'), (37, 'crops'),
                   (38, 'waterElectricity'), (40, 'advantage1'), (43, 'disadvantage1'), (45, 'specialRemarks')):
        cell(c, r, 5, key)
    for r, key in ((47, 'extentLine'), (48, 'extentLine'), (49, 'extentLine'), (50, 'extentLine'), (51, 'extentLine'),
                   (52, 'marketRateLine'), (53, 'guidelineRateLine'), (54, 'adoptedRateLine'), (55, 'landValueLine')):
        cell(c, r, 4, key)
    for row in list(c.rows)[6:18]:          # sample items 3 and 4 — replaced by the copied block
        row._tr.getparent().remove(row._tr)

    for r, key in ((0, 'absA'), (6, 'absTotal'), (7, 'absSayAs')):
        cell(t[3], r, 3, key)

    replace_all_body(doc, '12-02-2025', 'reportDate')
    places(doc)
    whole(doc, '14°44', T('gpsDms'))
    whole(doc, '14.748213, 78.730253', T('gpsDecimal'))
    mark_region(doc, 'LOCATION - MAP', 'PHOTOS', '{{img:areaMap:5943600:4114800}}')
    mark_images(doc, 'PHOTOS', 'photo', stop_text='14°')
    rename_image(doc, 'photo', 'map1')


FORMATS = {'house': house, 'apartment': apartment, 'open_site': open_site, 'agriculture': agriculture}

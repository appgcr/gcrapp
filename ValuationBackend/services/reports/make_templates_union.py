"""
Union Bank of India: fill-in templates from the bank's own sample reports (union_source/*.docx).

Run:  python3 make_templates.py union [house|apartment|open_site|agriculture|industrial]
Only the sample values are swapped for {{tags}}; the letterhead, tables, fonts, colours and
fixed wording stay exactly as the bank's file.
"""
from docx.oxml.ns import qn
from docx_tools import replace_span, find_para, para_text
from make_templates import (T, span, span_re, whole, cell, cspan, set_cell_para, mark_region, insert_marker_after,
                            replace_all_body, mark_images)
from make_templates_bob import places

PHOTO_W, PHOTO_H = 2743200, 2057400          # 3.0" x 2.25" — two photos side by side


def strip_shapes(doc, text):
    """The hand-drawn location sketch is a group of shapes anchored in its heading paragraph:
    remove the shapes, keep the heading text."""
    p = find_para(doc, text)
    MC = '{http://schemas.openxmlformats.org/markup-compatibility/2006}AlternateContent'
    for r in list(p._p.findall(qn('w:r'))):
        if r.find('.//' + qn('w:drawing')) is not None or r.find('.//' + qn('w:pict')) is not None \
                or r.find(MC) is not None:
            p._p.remove(r)
    return p


def photo_slots(doc, after_text, n_pairs=2, start=1):
    """Blank lines where the valuer pastes the site photos → photo markers, two per line."""
    p = find_para(doc, after_text)
    k = start
    for _ in range(n_pairs):
        p = insert_marker_after(p, '{{img:photo%d:%d:%d}}  {{img:photo%d:%d:%d}}' % (k, PHOTO_W, PHOTO_H, k + 1, PHOTO_W, PHOTO_H))
        k += 2
    return p


def location_map(doc, heading, end_text, close_up=True):
    strip_shapes(doc, heading)
    mark_region(doc, heading, end_text, '{{img:areaMap:5943600:4114800}}')
    if close_up:   # the bank's file has a satellite screenshot under the sketch → a close-up map
        insert_marker_after(find_para(doc, '{{img:areaMap'), '{{img:map1:5943600:3962400}}')


# --------------------------------------------------------------------------- HOUSE
def house(doc):
    t = doc.tables
    span(doc, 'FILE NO', '2606131', 'fileNo')
    span(doc, 'District   :', 'Y S R', 'district')
    span(doc, 'Branch', 'N.G.O COLONY BRANCH, KADAPA', 'bankBranchUpper')

    # Front page: owner and property summary
    span(doc, 'Lakshmi Reshma', 'Smt B. Lakshmi Reshma', 'owner1Name')
    span(doc, 'Madhusudhan', 'W/o  Sri  B. Madhusudhan Rao.', 'owner1Rel')
    span_re(doc, '42/529-14', r'Door No : .*\(Dt\)\.', 'owner1Addr')
    span(doc, 'Cell No', '9912768181', 'ownerPhone')
    span(doc, 'Deed No     :', '6662/2023', 'deedNo')
    span(doc, 'Deed No     :', '2.58', 'netExtentCents')
    span(doc, '38/160-27', '38/160-27', 'doorNo')
    span(doc, 'Survey No   :', '570/1, 570/2, 564/1, 564/2', 'surveyNo')
    span(doc, 'Plan Approval', '1013/0409/B/KAD/CCH/2023', 'planNo')
    span(doc, 'Plan Approval', '03-04-2023', 'planDate')
    L = 'Valuation  Report of'
    span_re(doc, L, r'Residential\s+Building \(GF\)', 'buildingDesc')
    span(doc, L, '570/1, 570/2, 564/1, 564/2', 'surveyNo')
    span(doc, L, '13', 'plotNo')
    span(doc, L, '38/160-27', 'doorNo')
    span(doc, L, '38', 'wardNo')
    span(doc, L, 'Buddayapalli', 'landmark')
    span(doc, L, ', Opp Toyato Show Room', 'nearByPart')
    span(doc, L, 'Chinnachowk', 'village')
    span(doc, L, 'Kadapa Municipal Corporation', 'localBodyName')
    span(doc, L, 'Y S R', 'district')
    span(doc, 'Valuation   :', '60,00,000', 'fmv')
    span(doc, '( RUPEES', 'SIXTY LAKHS', 'fmvWordsCoreUpper')
    span_re(doc, 'Kadapa Municipal Corporation Of', r'Kadapa.*', 'localBodyLine')

    # Values at the end of the report
    span_re(doc, 'As a result of my appraisal', r'Rs 60,00,000/- \(Rupees Sixty Lakhs Only\)',
            '=Rs ' + T('fmv') + '/- (' + T('fmvWords') + ')')
    span_re(doc, 'Net Realizable Value is', r'Rs 54,00,000/- \(Rupees Fifty Four Lakhs Only\)',
            '=Rs ' + T('realizable') + '/- (' + T('realizableWords') + ')')
    span_re(doc, 'Distress Value Rs', r'Rs 48,00,000/- \(Rupees Fourty Eight Lakhs Only\)',
            '=Rs ' + T('distress') + '/- (' + T('distressWords') + ')')

    a = t[0]
    for r, key in ((1, 'purpose'), (2, 'inspectionDate'), (3, 'valuationDate'), (7, 'mvCertificate'), (9, 'tenure'),
                   (16, 'postalLine'), (17, 'cityTown'), (18, 'areaResidential'), (19, 'areaCommercial'),
                   (20, 'areaIndustrial'), (22, 'areaClass'), (23, 'areaUrban'), (24, 'localBodyType'),
                   (25, 'govtEnactments'), (26, 'agriConversion'), (39, 'extentActual'), (40, 'netExtentPlan'),
                   (43, 'extentSite'), (44, 'extentConsidered'), (45, 'occupancy')):
        cell(a, r, 9, key)
    cspan(a, 5, 9, [('6662/2023', 'deedNo'), ('23-08-2023', 'deedDate')])
    cspan(a, 6, 9, [('1013/0409/B/KAD/CCH/2023', 'planNo')], para=0)
    cspan(a, 6, 9, [('03-04-2023', 'planDate')], para=1)
    set_cell_para(a, 8, 9, 1, T('owner1Name') + ',  ')
    set_cell_para(a, 8, 9, 2, T('owner1Rel'))
    set_cell_para(a, 8, 9, 3, T('owner1Addr'))
    set_cell_para(a, 8, 9, 4, 'Cell No : ' + T('ownerPhone'))
    cspan(a, 11, 9, [('570/1, 570/2, 564/1, 564/2', 'surveyNo')])
    cspan(a, 12, 9, [('38/160-27', 'doorNo')])
    cspan(a, 13, 9, [('Chinnachowk', 'village')])
    cspan(a, 14, 9, [('38', 'wardNo'), ('Buddayapalli', 'landmark')])
    cspan(a, 15, 9, [('Kadapa Municipal Corporation', 'localBodyName')], para=0)
    set_cell_para(a, 15, 9, 1, T('districtDotted') + ' (Dt)')
    for r, side in ((29, 'East'), (30, 'West'), (31, 'North'), (32, 'South')):
        cell(a, r, 7, f'bdDeed{side}')
        cell(a, r, 9, f'bdActual{side}')
    for r, side in ((35, 'East'), (36, 'West'), (37, 'North'), (38, 'South')):
        cell(a, r, 7, f'dimDeed{side}')
        cell(a, r, 9, f'dimActual{side}')
    cell(a, 39, 7, 'extentDeed')
    cell(a, 41, 9, '=Latitude    :  ' + T('latDms'))
    cell(a, 42, 9, '=Longitude :  ' + T('lngDms'))
    chars = ['locality', 'surroundings', 'flooding', 'civicAmenities', 'levelOfLand', 'landShape', 'landUse',
             'usageRestriction', 'layoutApproved', 'cornerPlot', 'roadFacilities', 'roadType', 'roadWidth',
             'landLocked', 'water', 'sewerage', 'power', 'advantage1', 'specialRemarks']
    for i, key in enumerate(chars):
        cell(a, 47 + i, 9, key)
    for r, key in ((67, 'landShape'), (68, 'sizeNorthSouth'), (69, 'sizeEastWest'), (70, 'totalExtent'),
                   (71, 'netExtentPlan'), (72, 'marketRateLine'), (73, 'guidelineRateLine'), (74, 'adoptedRateLine'),
                   (75, 'landValueLine'), (78, 'buildingType'), (79, 'constructionType'), (80, 'yearOfConstruction'),
                   (81, 'ageLine'), (82, 'remainingLifeLine'), (83, 'floorsLine')):
        cell(a, r, 9, key)

    b = t[1]
    cell(b, 3, 1, 'floorCodes')
    cell(b, 3, 2, 'plinthPlan')
    cell(b, 3, 5, 'plinthActual')
    cell(b, 6, 1, 'floorCodes')
    cell(b, 6, 2, 'carpetPlan')
    cell(b, 6, 5, 'carpetActual')
    cell(b, 8, 5, 'conditionExterior')
    cell(b, 9, 5, 'conditionInterior')
    cell(b, 10, 5, '=Date Of Issue : ' + T('planDate'), '=Date of Validity = ' + T('planValidity'))
    cell(b, 11, 5, 'planAuthority', 'planAuthority2')
    cell(b, 12, 5, 'planVerified')
    cell(b, 13, 5, 'planComments')

    c = t[2]
    specs = ['foundation', 'basement', 'superstructure', 'joinery', 'rccWorks', 'plastering', 'flooring',
             'specialFinish', 'roofing', 'drainage']
    for i, key in enumerate(specs):
        cell(c, 1 + i, 4, f'specGF_{key}')
    for r, key in ((12, 'compoundWall'), (13, 'cwHeight'), (14, 'cwLength'), (15, 'cwType'), (17, 'wiring'),
                   (18, 'fittingsClass'), (19, 'lightPoints'), (20, 'plugPoints'), (21, 'electricalOther'),
                   (23, 'waterClosets'), (24, 'washBasins'), (25, 'urinals'), (26, 'bathTubs'), (27, 'waterMeter'),
                   (28, 'otherFixtures')):
        cell(c, r, 5, key)

    # Building table: one row per floor
    e = t[3]
    for ci, key in ((0, 'fl.sno'), (1, 'fl.label'), (2, 'fl.plinth'), (3, 'fl.height'), (4, 'fl.age'),
                    (5, 'fl.rate'), (6, 'fl.replacement'), (8, 'fl.net')):
        cell(e, 1, ci, key)
    cell(e, 1, 7, 'fl.depPct', 'fl.depAmount')
    cell(e, 2, 8, 'buildingTotalLine')

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
    cell(g, 2, 2, 'declPurpose', 'declPurpose2')
    cspan(g, 5, 2, [('22-06-2026', 'valuationDate')], para=1)
    cspan(g, 5, 2, [('22-06-2026', 'reportDate')], para=2)

    span(doc, 'personally  inspected', '22-06-2026', 'inspectionDate')
    replace_all_body(doc, '22-06-2026', 'reportDate')
    places(doc)

    photo_slots(doc, 'Screen shot of longitude')
    location_map(doc, 'LOCATION – MAP', '14°27\'52.3')
    whole(doc, '14°27\'52.3', T('gpsDms'))
    whole(doc, '14.464516, 78.855859', T('gpsDecimal'))


# --------------------------------------------------------------------------- APARTMENT
def apartment(doc):
    """Cover page, photos and the valuer's comments (Union Bank's flat format)."""
    t = doc.tables
    span(doc, 'FILE ', '2601146', 'fileNo')
    span(doc, 'District    :', 'Y S R', 'district')
    span(doc, 'Branch     :', 'YERRAMUKKAPALLI BRANCH, KADAPA', 'bankBranchUpper')
    span(doc, 'KARTHIKEYA RESIDENCY', 'KARTHIKEYA RESIDENCY', 'aptNameUpper')
    whole(doc, 'Sri Vijaya Durga Builders', T('builderName'))
    span_re(doc, 'Upper Floors', r'Stilt \+ Ground Floor \+ 4 Upper Floors', 'floorsDesc')
    for i, loc in enumerate(['Mallikarjuna', 'Vijaya, ', 'Sai Sagar', 'Sunil Jayanth', 'Venkata Suresh'], start=1):
        whole(doc, loc, T(f'ownerLine{i}'))
    whole(doc, 'Applicant', T('applicantLabel'))
    span(doc, '3742/2023', '3742/2023', 'deedNo')
    span(doc, 'out of', '0.97', 'udsCents')
    span(doc, 'out of', '39.519', 'parentCents')
    span(doc, '11108/2022', '11108/2022', 'deed2No')
    span(doc, 'Flat ', '302', 'flatNo')
    span(doc, 'Flat ', 'Third', 'floorName')
    span(doc, 'Flat ', '292, 310/B2', 'surveyNo')
    span_re(doc, 'PLAN APPROVED UNDER', r'1013/1257/B/KAD/GDR/2023', 'planNo')
    span(doc, 'PLAN APPROVED UNDER', '17-11-2023', 'planDate')
    span_re(doc, 'Valuation Report of', r'Residential Flat In “.*', 'aptTitle')
    span(doc, 'Valuation   :', '39,20,000', 'fmv')
    span_re(doc, 'RUPEES :', r'THIRTY NINE LAKHS TWENTY THOUSAND', 'fmvWordsCoreUpper')
    whole(doc, 'Kadapa Municipal Corporation, Y.S.R Dist.', T('localBodyLine'))

    # Applicants (up to two) and their address
    a = t[0].rows[0].cells
    for i, key in enumerate(['applicant1Name', 'applicant1Rel', 'applicant2Name', 'applicant2Rel']):
        set_cell_para(t[0], 0, 0, i, T(key))
    set_cell_para(t[0], 0, 1, 0, T('applicantAddr'))

    g = t[1]
    cell(g, 1, 2, 'declBackground', 'declBuilding')
    cell(g, 2, 2, 'declPurpose')
    cell(g, 5, 2, 'declDates1', 'declDates2', 'declDates3')

    replace_all_body(doc, '28-01-2026', 'reportDate')
    for p in doc.paragraphs:
        if 'Place' in para_text(p) and 'KADAPA' in para_text(p):
            replace_span(p, 'KADAPA', T('placeUpper'))
    mark_images(doc, 'PHOTO', 'photo')


# --------------------------------------------------------------------------- OPEN SITE
def open_site(doc):
    t = doc.tables
    span(doc, 'FILE NO', '2512102', 'fileNo')
    span(doc, 'District    :', 'Y S R', 'district')
    span(doc, 'Branch:', 'MAIN BRANCH, KADAPA', 'bankBranchUpper')
    span(doc, 'Subbaiah', 'Sri. P. Venkata Subbaiah', 'owner1Name')
    span(doc, 'Naganna', 'S/o. Sri. P. Naganna.', 'owner1Rel')
    span_re(doc, 'Salenagaiah', r'Door No :.*\(Dt\)\.', 'owner1Addr')
    span(doc, 'Deed No   :', '6422/2025', 'deedNo')
    span(doc, 'Deed No   :', '1.54', 'netExtentCents')
    span(doc, 'Survey No', '2/311-1', 'doorNo')
    span(doc, 'Survey No', '189/5', 'surveyNo')
    span(doc, '1&2', '1&2', 'plotNo')
    span(doc, 'Plan Approved B.A', '1013/1215/B/KAD/CCH/2024', 'planNo')
    span(doc, 'Plan Approved B.A', '27-11-2025', 'planDate')
    span_re(doc, 'Valuation Report of', r'Residential Vacant Site,.*', 'siteTitle')
    span(doc, 'Valuation :', '18,40,000', 'fmv')
    span(doc, '(RUPEES', 'EIGHTEEN LAKHS FORTY THOUSAND', 'fmvWordsCoreUpper')
    span_re(doc, 'Kadapa Municipal Corporation, Y.S.R (', r'Kadapa.*', 'localBodyLine')
    span_re(doc, 'Eighteen', r'Rs\. 18,40,000/- \(Rupees Eighteen Lakhs Forty Thousand Only\)',
            '=Rs. ' + T('fmv') + '/- (' + T('fmvWords') + ')')
    span_re(doc, 'Net Realizable Value is', r'Rs\. 16,56,000/-\(Rupees Sixteen Lakhs Fifty Six Thousand Only\)',
            '=Rs. ' + T('realizable') + '/-(' + T('realizableWords') + ')')
    span_re(doc, 'Net Realizable Value is', r'Rs\. 14,72,000/- \(Rupees Fourteen Lakhs Seventy Two Thousand  Only\)',
            '=Rs. ' + T('distress') + '/- (' + T('distressWords') + ')')

    a = t[0]
    for r, key in ((1, 'purpose'), (2, 'inspectionDate'), (3, 'valuationDate'), (7, 'mvCertificate'),
                   (9, 'briefDesc'), (16, 'postalLine'), (41, 'extentDeed'), (42, 'extentActual'),
                   (43, 'extentConsidered'), (44, 'occupancy')):
        cell(a, r, 12, key)
    for r, key in ((17, 'cityTown'), (18, 'areaResidential'), (19, 'areaCommercial'), (20, 'areaIndustrial'),
                   (22, 'areaClass'), (23, 'areaUrban'), (24, 'localBodyType'), (25, 'govtEnactments'),
                   (26, 'agriConversion')):
        cell(a, r, 11, key)
    cspan(a, 5, 12, [('6422/2025', 'deedNo'), ('08-10-2025', 'deedDate')])
    cell(a, 6, 12, '=B.A No :' + T('planNo') + ', ', '=DT : ' + T('planDate'))
    set_cell_para(a, 8, 12, 1, T('owner1Name') + ', ')
    set_cell_para(a, 8, 12, 2, T('owner1Rel'))
    set_cell_para(a, 8, 12, 3, T('owner1Addr'))
    cspan(a, 11, 12, [('189/5', 'surveyNo')])
    cell(a, 12, 12, '=Door No : ' + T('doorNo') + ', ', '=Plot No : ' + T('plotNo') + ', ')
    cspan(a, 13, 12, [('Nagarajupeta', 'village')])
    cell(a, 14, 12, '=Ward No :- ' + T('wardNo') + ', In ' + T('landmark') + ',')
    cell(a, 15, 12, '=' + T('localBodyName') + ' of  ', '=' + T('districtDotted') + ' (Dt).')
    for r, side in ((29, 'East'), (30, 'West'), (31, 'North'), (32, 'South')):
        cell(a, r, 7, f'bdDeed{side}')
        cell(a, r, 11, f'bdActual{side}')
    for r, side in ((35, 'East'), (36, 'West'), (37, 'North'), (38, 'South')):
        cell(a, r, 7, f'dimDeed{side}')
        cell(a, r, 11, f'dimActual{side}')
    cell(a, 39, 7, 'extentDeed')
    cell(a, 39, 11, 'extentActual')
    cell(a, 40, 12, 'gpsDms', 'gpsDecimal')
    chars = ['locality', 'surroundings', 'flooding', 'civicAmenities', 'levelOfLand', 'landShape', 'landUse',
             'usageRestriction', 'layoutApproved', 'cornerPlot', 'roadFacilities', 'roadType', 'roadWidth',
             'landLocked', 'water', 'sewerage', 'power', 'advantage1', 'specialRemarks']
    for i, key in enumerate(chars):
        cell(a, 46 + i, 12, key)
    for r, key in ((67, 'sizeNorthSouth'), (68, 'sizeEastWest'), (69, 'totalExtent'), (70, 'netExtentPlan'),
                   (71, 'marketRateLine'), (72, 'guidelineRateLine'), (73, 'adoptedRateLine'), (74, 'landValueLine')):
        cell(a, r, 12, key)
    cell(t[7], 0, 3, 'absA')
    cell(t[7], 6, 3, 'absTotal')
    cell(t[7], 7, 3, 'absSayAs')
    g = t[8]
    cell(g, 1, 2, 'declBackground', 'pinLine')
    cell(g, 2, 2, 'declPurpose')
    cspan(g, 5, 2, [('15-12-2025', 'inspectionDate')], para=0)
    cspan(g, 5, 2, [('15-12-2025', 'valuationDate')], para=1)
    cspan(g, 5, 2, [('15-12-2025', 'reportDate')], para=2)

    span(doc, 'personally  inspected', '15-12-2025', 'inspectionDate')
    replace_all_body(doc, '15-12-2025', 'reportDate')
    places(doc)
    mark_images(doc, 'PHOTOS:', 'photo', stop_text='LOCATION MAP')
    location_map(doc, 'LOCATION MAP :', '14°28\'09.0')
    whole(doc, '14°28\'09.0', T('gpsDms'))
    whole(doc, '14.469167, 78.829854', T('gpsDecimal'))


# --------------------------------------------------------------------------- AGRICULTURE
def agriculture(doc):
    t = doc.tables
    span(doc, 'FILE NO', '2505144', 'fileNo')
    span(doc, 'District   :', 'Y S R', 'district')
    span(doc, 'Branch', 'CMR PALLI BRANCH, KADAPA', 'bankBranchUpper')
    span(doc, 'Babu Reddy', 'Smt. K. Lakshmi', 'owner1Name')
    span(doc, 'Babu Reddy', 'W/o. Sri. Babu Reddy.', 'owner1Rel')
    span_re(doc, '46/51-1-A', r'Door No :.*\(DT\)\.', 'owner1Addr')
    # Land items: Khata, one line per survey number, total
    whole(doc, 'Khata No : 194', T('khataLine'))
    whole(doc, 'Survey No : 176', T('agLines'))
    whole(doc, 'Survey No : 175', T('agSourceLine'))
    span(doc, 'Total Extent :', '2.10', 'totalAcres')
    span_re(doc, 'Valuation Report of', r'Agriculture Land, In .*', 'agTitle')
    span(doc, 'VALUATION:', '29,40,000', 'fmv')
    span(doc, '(RUPEES', 'TWENTY NINE LAKHS FORTY THOUSAND', 'fmvWordsCoreUpper')
    span_re(doc, 'DINNE MANDAL, Y.S.R', r'C\.K\. DINNE MANDAL, Y\.S\.R \(DT\)\.', 'mandalLineUpper')
    span_re(doc, 'Twenty Nine', r'29,40,000/-\(Rupees Twenty Nine Lakhs Forty Thousand Only\)',
            '=' + T('fmv') + '/-(' + T('fmvWords') + ')')
    span_re(doc, 'Twenty Six', r'26,50,000/- \(Rupees Twenty Six Lakhs Fifty Thousand Only\)',
            '=' + T('realizable') + '/- (' + T('realizableWords') + ')')
    span_re(doc, 'Twenty Three', r'23,50,000/- \(Rupees Twenty Three Lakhs Fifty Thousand Only\)',
            '=' + T('distress') + '/- (' + T('distressWords') + ')')

    a = t[0]
    for r, key in ((1, 'purpose'), (2, 'inspectionDate'), (3, 'valuationDate'), (5, 'khataNo'), (7, 'planLine'),
                   (8, 'mvCertificate'), (10, 'tenure'), (12, 'surveyLine'), (13, 'doorNo'), (14, 'villageLine'),
                   (15, 'panchayatLine'), (16, 'mandalLine'), (17, 'postalAddress'), (18, 'cityTown'),
                   (19, 'areaResidential'), (20, 'areaCommercial'), (21, 'areaIndustrial'), (22, 'areaAgriculture'),
                   (24, 'areaClass'), (25, 'areaUrban'), (26, 'localBodyType'), (27, 'govtEnactments'),
                   (28, 'agriConversion')):
        cell(a, r, 7, key)
    set_cell_para(a, 6, 1, 0, 'Khata No : ' + T('khataNo') + ', ')
    set_cell_para(a, 6, 1, 1, T('agLines'))
    set_cell_para(a, 6, 1, 2, T('agSourceLine'))
    set_cell_para(a, 6, 1, 3, '                              Total Extent : Ac ' + T('totalAcres') + ' Cents,')
    set_cell_para(a, 9, 7, 1, T('owner1Name') + ',')
    set_cell_para(a, 9, 7, 2, ' ' + T('owner1Rel'))
    set_cell_para(a, 9, 7, 3, ' ' + T('owner1Addr'))

    b = t[1]
    cell(b, 3, 3, 'extentDeed')
    cell(b, 3, 5, 'extentActual')
    cell(b, 6, 3, 'extentDeed')
    cell(b, 6, 5, 'extentActual')
    for r, key in ((7, 'extentPlan'), (10, 'extentPlan'), (11, 'extentActual'), (12, 'extentConsidered'),
                   (13, 'occupancy')):
        cell(b, r, 5, key)
    cell(b, 8, 6, 'gpsDms', 'gpsDecimal')
    chars = ['locality', 'surroundings', 'flooding', 'civicAmenities', 'levelOfLand', 'landShape', 'landUse',
             'usageRestriction', 'layoutApproved', 'cornerPlot', 'roadFacilities', 'roadType', 'roadWidth',
             'landLocked', 'water', 'sewerage', 'power', 'advantage1', 'specialRemarks']
    for i, key in enumerate(chars):
        cell(b, 15 + i, 5, key)
    for r, key in ((35, 'landShape'), (36, 'extentDeed'), (37, 'extentDeed'), (38, 'extentActual'),
                   (39, 'extentConsidered'), (40, 'marketRateLine'), (41, 'guidelineRateLine'),
                   (42, 'adoptedRateLine'), (43, 'landValueLine')):
        cell(b, r, 5, key)
    for r, key in ((0, 'absA'), (6, 'absTotal'), (7, 'absSayAs')):
        cell(t[2], r, 3, key)
    g = t[3]
    cell(g, 1, 2, 'declBackground')
    cell(g, 2, 2, 'declPurpose')
    cspan(g, 5, 2, [('26-05-2025', 'inspectionDate')], para=0)
    cspan(g, 5, 2, [('26-05-2025', 'valuationDate')], para=1)
    cspan(g, 5, 2, [('26-05-2025', 'reportDate')], para=2)

    span(doc, 'personally  inspected', '26-05-2025', 'inspectionDate')
    replace_all_body(doc, '26-05-2025', 'reportDate')
    places(doc)
    mark_images(doc, 'PHOTOS :', 'photo', stop_text='Map :')
    mark_images(doc, 'Map :', 'map')
    whole(doc, '14°26\'02.1', T('gpsDms'))
    whole(doc, '14.433905, 78.749730', T('gpsDecimal'))


# --------------------------------------------------------------------------- INDUSTRIAL BUILDING / SHED
def industrial(doc):
    t = doc.tables
    span(doc, 'FILE NO', '2507029', 'fileNo')
    span(doc, 'District    :', 'Y S R', 'district')
    span(doc, 'KOTI REDDY', 'KOTI REDDY CIRCLE BRANCH, KADAPA', 'bankBranchUpper')
    # Owners (up to four) and up to two addresses — unused lines disappear
    for i, loc in enumerate(['Harinatha Reddy, ', 'Lakshmi Prasanna', 'Soma Sekhar Reddy, ', 'Neelima'], start=1):
        whole(doc, loc, T(f'ownerLine{i}'))
    whole(doc, 'Parvathareddygaripalle', T('owner1Addr'))
    whole(doc, 'Jayapadma Towers', T('owner2Addr'))
    span(doc, 'Deed No    :', '8246/2019', 'deedNo')
    span(doc, 'Deed No    :', '3341.58', 'netExtentSqyd')
    span(doc, 'Survey', '190', 'plotNo')
    span(doc, 'Survey', '1043/2 (Part) & 141', 'surveyNo')
    span(doc, 'Shed No ', 'S – 5', 'shedNo')
    span(doc, 'Plan Approval No', 'D. Dis. No : A/120/KADAPA/2014, Dt : 10-04-2014.', 'planLine')
    whole(doc, 'Issued By Inspectors Of Industries', T('planAuthority'))
    span_re(doc, 'Valuation Report of', r'Industrial Building \(GF\) At .*', 'shedTitle')
    span(doc, 'Valuation :', '4,06,10,000', 'fmv')
    span(doc, '(RUPEES', 'FOUR CRORE SIX LAKHS TEN THOUSAND', 'fmvWordsCoreUpper')
    span_re(doc, 'Kadapa Municipal Corporation, Y.S.R (', r'Kadapa.*', 'localBodyLine')
    span_re(doc, 'One Crore Seventy Two', r'Rs\. 4,06,10,000/- \(Rupees One Crore Seventy Two Lakhs Thirty Five Thousand Only\)',
            '=Rs. ' + T('fmv') + '/- (' + T('fmvWords') + ')')
    span_re(doc, 'Net Realizable Value is', r'Rs\. 3,65,50,000/-\(Rupees Three Crore Sixty Five Lakhs Fifty Thousand Only\)',
            '=Rs. ' + T('realizable') + '/-(' + T('realizableWords') + ')')
    span_re(doc, 'Net Realizable Value is', r'Rs\. 3,24,90,000/- \(Rupees Three Crore Twenty Four Lakhs Ninety Thousand Only\)',
            '=Rs. ' + T('distress') + '/- (' + T('distressWords') + ')')

    a = t[0]
    for r, key in ((1, 'purpose'), (2, 'inspectionDate'), (3, 'valuationDate'), (7, 'mvCertificate'),
                   (11, 'surveyLine'), (12, 'plotShedLine'), (13, 'villageLine'), (14, 'areaLine'),
                   (43, 'extentDeed')):
        cell(a, r, 8, key)
    for r, key in ((17, 'cityTown'), (18, 'areaResidential'), (19, 'areaCommercial'), (20, 'areaIndustrial'),
                   (22, 'areaClass'), (23, 'areaUrban'), (24, 'localBodyType'), (25, 'govtEnactments'),
                   (26, 'agriConversion')):
        cell(a, r, 7, key)
    cspan(a, 5, 8, [('8246/2019', 'deedNo'), ('23-10-2019', 'deedDate')], para=1)
    cell(a, 6, 8, 'planLineFull', 'planAuthority')
    keys = []
    for i in range(1, 5):
        keys += [f'owner{i}NameLine', f'owner{i}RelLine']
    for i, key in enumerate(keys, start=1):
        set_cell_para(a, 8, 8, i, T(key))
    set_cell_para(a, 8, 8, 9, T('owner1AddrLine'))
    set_cell_para(a, 8, 8, 10, T('owner2AddrLine'))
    cell(a, 9, 8, 'briefDesc', 'pinLine')
    cell(a, 15, 8, '=' + T('localBodyName') + ' of  ', '=' + T('districtDotted') + ' (Dt)')
    cell(a, 16, 8, 'postalLine', 'pinLine')
    for r, side in ((29, 'East'), (30, 'West'), (31, 'North'), (32, 'South')):
        cell(a, r, 5, f'bdDeed{side}')
        cell(a, r, 7, f'bdActual{side}')
    for r, side in ((35, 'East'), (36, 'West'), (37, 'North'), (38, 'South')):
        cell(a, r, 5, f'dimDeed{side}')
        cell(a, r, 7, f'dimActual{side}')
    cell(a, 34, 1, '=As per deed Plot No: ' + T('plotNo'))
    cell(a, 39, 5, 'extentDeed')
    cell(a, 39, 7, 'extentActual')
    cell(a, 40, 1, '=As Per Plan Net Extent : ' + T('extentPlan'))
    cell(a, 41, 9, 'latDms')
    cell(a, 42, 9, 'lngDms')

    b = t[1]
    for r, key in ((0, 'extentActual'), (1, 'extentConsidered'), (2, 'occupancy')):
        cell(b, r, 7, key)
    chars = ['locality', 'surroundings', 'flooding', 'civicAmenities', 'levelOfLand', 'landShape', 'landUse',
             'usageRestriction', 'layoutApproved', 'cornerPlot', 'roadFacilities', 'roadType', 'roadWidth',
             'landLocked', 'water', 'sewerage', 'power', 'advantage1', 'specialRemarks']
    for i, key in enumerate(chars):
        cell(b, 4 + i, 7, key)
    for r, key in ((25, 'extentDeed'), (26, 'extentDeed'), (27, 'extentDeed'), (28, 'extentConsidered'),
                   (29, 'marketRateLine'), (30, 'guidelineRateLine'), (31, 'adoptedRateLine'), (32, 'landValueLine')):
        cell(b, r, 7, key)
    for r, key in ((35, 'buildingType'), (36, 'constructionType'), (37, 'yearOfConstruction'), (38, 'ageLine'),
                   (39, 'remainingLifeLine'), (40, 'floorsLine'), (44, 'conditionExterior'), (45, 'conditionInterior'),
                   (46, 'planLineFull'), (47, 'planAuthority'), (48, 'planVerified'), (49, 'planComments')):
        cell(b, r, 9, key)
    cell(b, 42, 3, '=As Per Plan : ' + T('plinthPlan'), '=As Per Actual : ' + T('plinthActual'), 'plinthNote')

    c = t[2]
    specs = ['foundation', 'basement', 'superstructure', 'joinery', 'rccWorks', 'plastering', 'flooring',
             'specialFinish', 'roofing', 'drainage']
    for i, key in enumerate(specs):
        cell(c, 1 + i, 4, f'specGF_{key}')
    for r, key in ((12, 'compoundWall'), (13, 'cwHeight'), (14, 'cwLength'), (15, 'cwType'), (17, 'wiring'),
                   (18, 'fittingsClass'), (19, 'lightPoints'), (20, 'fanPoints'), (21, 'plugPoints'),
                   (22, 'electricalOther'), (24, 'waterClosets'), (25, 'washBasins'), (26, 'urinals'),
                   (27, 'bathTubs'), (28, 'waterMeter'), (29, 'otherFixtures')):
        cell(c, r, 4, key)

    e = t[3]
    for ci, key in ((0, 'fl.sno'), (2, 'fl.plinth'), (3, 'fl.height'), (5, 'fl.rate'), (6, 'fl.replacement'),
                    (8, 'fl.net')):
        cell(e, 1, ci, key)
    cell(e, 1, 1, 'fl.label', 'fl.use')
    cell(e, 1, 4, 'fl.ageNum', '=Years')
    cell(e, 1, 7, 'fl.dep')
    cell(e, 2, 8, 'buildingTotalLine')

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
    cspan(g, 5, 2, [('07-07-2025', 'inspectionDate')], para=0)
    cspan(g, 5, 2, [('07-07-2025', 'valuationDate')], para=1)
    cspan(g, 5, 2, [('07-07-2025', 'reportDate')], para=2)

    span(doc, 'personally  inspected', '07-07-2025', 'inspectionDate')
    replace_all_body(doc, '07-07-2025', 'reportDate')
    places(doc)
    location_map(doc, 'Location Map', 'PHOTO’S', close_up=False)
    mark_images(doc, 'PHOTO’S', 'photo', stop_text='GOOGLE MAP')
    mark_images(doc, 'GOOGLE MAP', 'map')
    whole(doc, '14°26\'30.2', T('gpsDms'))
    whole(doc, '14.441728, 78.869645', T('gpsDecimal'))


FORMATS = {'house': house, 'apartment': apartment, 'open_site': open_site, 'agriculture': agriculture,
           'industrial': industrial}

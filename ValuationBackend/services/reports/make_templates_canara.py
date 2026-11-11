"""
Canara Bank: fill-in templates from the bank's own sample reports (canara_source/*.docx).
Run:  python3 make_templates.py canara [house|apartment|open_site|agriculture]
"""
import re
from docx_tools import find_para, para_text, replace_span
from make_templates import (T, span, span_re, whole, cell, cspan, set_cell_para, mark_region, mark_images,
                            replace_all_body, p_span_re)
from make_templates_bob import places, rename_image, tb_span  # noqa: F401
from make_templates_boi import marker_before

AMENITIES = ['cn_portico', 'cn_frontDoor', 'cn_sitOut', 'cn_gates', 'cn_staircase', 'cn_wardrobes', 'cn_glazedTiles',
             'cn_sinks', 'cn_marble', 'cn_interior', 'cn_elevation', 'cn_falseCeiling', 'cn_paneling', 'cn_aluminium',
             'cn_handRails', 'cn_lumber', 'cn_toilet', 'cn_sump', 'cn_trees', 'cn_other']
SERVICES = ['cs_water', 'cs_drainage', 'cs_compoundWall', 'cs_pavements', 'cs_steelGate', 'cs_deposits',
            'cs_electrical', 'cs_wiring', 'cs_fittings', 'cs_lightPoints', 'cs_fanPoints', 'cs_plugPoints',
            'cs_electricalOther', 'cs_plumbing', 'cs_waterClosets', 'cs_washBasins', 'cs_bathTubs', 'cs_waterMeter',
            'cs_fixtures', 'cs_other']
LOC = 'In Sade Khan Street, Sai Peta, Near Almaspeta Circle'


# --------------------------------------------------------------------------- HOUSE
def house(doc):
    t = doc.tables
    span(doc, 'File', '2605106', 'fileNo')
    span(doc, 'Canara Bank, Mochampeta', 'Mochampeta Branch', 'bankBranchName')
    span(doc, 'Kadapa Town, Y.S.R', 'Kadapa Town, Y.S.R. (Dt).', 'branchPlace')
    span(doc, 'Bhagya Lakshmi', 'Smt. Y. Bhagya Lakshmi Devi', 'owner1Name')
    span(doc, 'Sreenivasulu', 'W/o. Sri. Y. Sreenivasulu', 'owner1Rel')
    span_re(doc, 'Sai Peta, Kadapa City', r'Door No’s : .*\(DT\)\.', 'owner1Addr')
    span(doc, '7780118600', '7780118600', 'ownerPhone')
    span(doc, '6948/2005', '6948/2005', 'deedNo')
    span(doc, 'Extent    :  2.50', '2.50', 'deed1Cents') if False else span(doc, T('deedNo'), '2.50', 'deed1Cents')
    span(doc, '2251/2010', '2251/2010', 'deed2No')
    span(doc, T('deed2No'), '1.72', 'deed2Cents')
    span(doc, 'Total Extent', '4.22', 'totalCents')
    span(doc, 'Net Extent As Per', '4.22', 'planCents')
    span(doc, 'Survey No’s  ', '8/1367, 8/1367-1-2-3', 'doorNo')
    span(doc, 'Survey No’s  ', '387', 'surveyNo')
    span(doc, '82/G1/2005', '82/G1/2005', 'planNo')
    span(doc, '20-06-2005', '20-06-2005', 'planDate')
    whole(doc, '157/G1/2014, Dt : 20-03-2014.', '                  Plan Approved Under B.A. No : ' + T('plan2No') + ', Dt : ' + T('plan2Date') + '.')
    L = 'Valuation Report of'
    for old, tag in (('Residential Building (GF+FF)', 'buildingDesc'), ('387', 'surveyNo'), ('8/1367, 8/1367-1-2-3', 'doorNo'),
                     ('8', 'wardNo'), (LOC, 'locationText'), ('Guduru', 'village'),
                     ('Kadapa Municipal Corporation Of  Y.S.R. (Dt).', 'localBody')):
        span(doc, L, old, tag)
    span(doc, 'VALUATION :', '1,02,98,000', 'fmv')
    p = find_para(doc, 'considered opinion')
    replace_span(p, '1,02,98,000', T('fmv'))
    p_span_re(p, r'\((Rupees One Crore[^)]*Only)\)', 'fmvWords', group=1)
    span_re(doc, 'ONE CRORE', r'\(RUPEES.*ONLY\)', '=(' + T('fmvWordsUpper') + ')')
    span_re(doc, 'MUNICIPAL CORPORATION, Y', r'KADAPA.*', 'localBodyUpper')
    whole(doc, ' 82/G1/2005,   Dt : 20-06-2005.', '         B.A. No : ' + T('planNo') + ',   Dt : ' + T('planDate') + '.')
    whole(doc, ' 157/G1/2014, Dt : 20-03-2014.', '          B.A. No : ' + T('plan2No') + ', Dt : ' + T('plan2Date') + '.')
    span(doc, 'Approved map/plan issuing', 'Kadapa Municipal Commissioner', 'planAuthority')
    p = find_para(doc, 'Ninety Seven')
    replace_span(p, '97,85,000', T('realizable'))
    p_span_re(p, r'\((Rupees [^)]*only)\)', 'realizableWords', group=1)
    replace_span(p, '92,70,000', T('distress'))
    p_span_re(p, r'\((Rupees Ninety Two[^)]*Only)\)', 'distressWords', group=1)
    span(doc, 'prevailing market rate for land', '1,02,98,000', 'fmv')
    span(doc, 'forced sale value', '92,70,000', 'distress')
    p = find_para(doc, 'Number of title deed')
    for old, tag in (('One', 'deedCountWord'), ('17-06-2005 & 22-04-2010', 'deedDatesLine'), ('6948/2005, 2251/2010', 'deedNosLine'),
                     ('Cuddapah (R.O)', 'sroName')):
        replace_span(p, old, T(tag))
    p = find_para(doc, 'The property was inspected on')
    replace_span(p, 'Manager, Canara Bank, Mochampeta Branch, Kadapa City, Y.S.R (Dt).', 'Manager, Canara Bank, ' + T('bankBranchLine'))
    whole(doc, 'Mochampeta Branch, Kadapa City, ', 'The request from The Branch Manager, ' + T('bankBranchLine'))
    whole(doc, '          Y.S.R (Dt).', ' ')

    a = t[0]
    for r, key in ((0, 'purpose'), (1, 'inspectionDate'), (2, 'valuationDate'), (7, 'mvCertificate'), (8, 'briefDescription'),
                   (9, 'scope'), (10, 'bankPurposeLine')):
        cell(a, r, 3, key)
    for i, (key, suf) in enumerate((('owner1Name', ', '), ('owner1Rel', '.'), ('owner1Addr', ''), ('blank', ''),
                                    ('ownerPhoneLine', '')), start=1):
        set_cell_para(a, 3, 3, i, T(key) + suf)
    cell(a, 5, 3, 'deed1Line', 'deed2Line')
    cell(a, 6, 3, 'plan1Line', 'plan2Line')
    b = t[1]
    for r, key in ((0, 'postalAddress'), (1, 'cityTown'), (2, 'areaResidential'), (3, 'areaCommercial'), (4, 'areaIndustrial'),
                   (6, 'localBodyType'), (7, 'govtEnactments'), (8, 'agriConversion'), (19, 'electricityLine'),
                   (20, 'occupiedBy'), (21, 'monthlyRent'), (22, 'rentNote')):
        cell(b, r, 6, key)
    cell(b, 9, 6, '', 'surveyLine', 'doorLine', 'villageLine', 'wardLine', 'localBodyComma')
    cell(b, 11, 3, 'deed1Header')
    cell(b, 11, 6, 'deed2Header')
    for r, side in ((12, 'North'), (13, 'South'), (14, 'East'), (15, 'West')):
        cell(b, r, 3, f'bdDeed{side}')
        cell(b, r, 6, f'bd2{side}')
    cell(b, 16, 7, 'gpsDms', 'gpsDecimal')
    cell(b, 18, 6, '', 'assessmentNo', 'taxAmountLine', 'taxPaidName')
    c = t[3]
    cell(c, 1, 2, 'deed1Header')
    cell(c, 1, 5, 'deed2Header')
    for r, side in ((2, 'East'), (3, 'West'), (4, 'North'), (5, 'South')):
        cell(c, r, 2, f'dimDeed{side}')
        cell(c, r, 5, f'dim2{side}')
    cell(c, 6, 2, 'deed1ExtentLine')
    cell(c, 6, 5, 'deed2ExtentLine')
    cell(c, 7, 1, 'totalExtentSummary')
    cell(c, 8, 5, 'netExtentPlan')
    for r in (9, 11, 12, 13, 14):
        cell(c, r, 4, 'extentConsidered')
    chars = ['locality', 'localityClass', 'surroundings', 'flooding', 'civicAmenities', 'levelOfLand', 'landShape',
             'landUse', 'usageRestriction', 'layoutApproved', 'cornerPlot', 'roadFacilities', 'landLocked', 'roadType',
             'roadWidth', 'sewerage', 'advantage1', 'specialRemarks', 'marketabilityFactors', 'landType', 'accessibility']
    for i, key in enumerate(chars):
        cell(c, 16 + i, 4, key)
    cell(c, 39, 4, 'guidelineRateLine', 'glrLandLine')
    from docx_tools import replace_span as rs
    for para in c.rows[39].cells[1].paragraphs:
        if '203.88' in para_text(para):
            rs(para, '203.88', T('consideredYd'))
            rs(para, '9100', T('guideRate'))
    for para in c.rows[42].cells[1].paragraphs:
        if '4.22' in para_text(para):
            rs(para, '4.22', T('consideredCents'))
            rs(para, 'Rs 7,00,000/-', 'Rs ' + T('marketRate') + '/-')
    cell(c, 40, 4, 'pmrRateLine')
    cell(c, 42, 4, '', 'marketRateLine', '', '', 'landValueLine')
    d = t[4]
    cell(d, 7, 1, 'plinthPlan')
    cell(d, 7, 3, 'plinthActual')
    cell(d, 9, 1, 'carpetPlan')
    cell(d, 9, 3, 'carpetActual')
    e = t[5]
    cell(e, 0, 5, 'floorsLine')
    for ci, key in ((0, 'bd.label'), (2, 'bd.year'), (3, 'bd.roof'), (4, 'bd.plinth'), (6, 'bd.cantilever'), (7, 'bd.plinth')):
        cell(e, 3, ci, key)
    e._tbl.remove(e.rows[4]._tr)
    cell(e, 4, 7, 'plinthTotalLine')
    g = t[6]
    specs = ['foundation', 'floorFinish', 'superstructure', 'roof', 'doors', 'windows', 'weathering']
    for i, key in enumerate(specs):
        cell(g, 2 + i, 1, f'specGF_{key}')
        cell(g, 2 + i, 3, f'specFF_{key}')
        cell(g, 2 + i, 5, f'specSF_{key}')
    for r, key in ((9, 'Plinth'), (10, 'Year')):
        cell(g, r, 1, f'b1{key}')
        cell(g, r, 3, f'b2{key}')
        cell(g, r, 5, f'b3{key}')
    cell(g, 11, 1, 'agesLine')
    cell(g, 12, 1, 'lifeLeftLine')
    cell(g, 13, 1, 'totalLifeLine')
    for r, key in ((14, 'DepPct'), (15, 'RateLine'), (16, 'Repl'), (17, 'Dep'), (18, 'Net')):
        cell(g, r, 1, f'b1{key}')
        cell(g, r, 2, f'b2{key}')
    cell(g, 19, 1, 'buildingTotalLine')
    k = t[7]
    for ci, key in ((0, 'bd.sno'), (1, 'bd.label'), (2, 'bd.plinthSqft'), (3, 'bd.height'), (4, 'bd.ageLine'),
                    (5, 'bd.rateLine'), (6, 'bd.repl'), (8, 'bd.net')):
        cell(k, 1, ci, key)
    cell(k, 1, 7, 'bd.depPct', 'bd.dep')
    k._tbl.remove(k.rows[2]._tr)
    cell(k, 2, 8, 'buildingTotalLine')
    for r, key in enumerate(AMENITIES + ['amenitiesTotal']):
        cell(t[8], r, 3, key)
    for r, key in enumerate(SERVICES + ['servicesTotal']):
        cell(t[9], r, 3, key)
    m = t[10]
    for r, (glr, pmr) in ((2, ('glrLand', 'pmrLand')), (3, ('glrBuilding', 'pmrBuilding')), (4, (None, 'pmrAmenities')),
                          (5, (None, 'pmrServices')), (6, ('glrTotal', 'pmrTotal')), (7, ('glrTotal', 'pmrSay'))):
        if glr:
            cell(m, r, 2, glr)
        cell(m, r, 3, pmr)
    cell(m, 8, 3, 'plusFactors')
    cell(m, 9, 3, 'minusFactors')
    cell(m, 10, 3, 'presentValueLine')
    n = t[11]
    cell(n, 1, 2, 'declBackground')
    cell(n, 2, 2, 'declPurpose')
    cell(n, 5, 2, 'declDates1', 'declDates2', 'declDates3')

    replace_all_body(doc, '29-05-2026', 'reportDate')
    places(doc)
    whole(doc, '14°29', T('gpsDms'))
    whole(doc, '14.491799, 78.814492', T('gpsDecimal'))
    mark_region(doc, 'LOCATION – MAP', 'PHOTO’S', '{{img:areaMap:5943600:4114800}}')
    mark_images(doc, 'PHOTO’S', 'photo', stop_text='GOOGLE – MAP')
    mark_images(doc, 'GOOGLE – MAP', 'map')


# --------------------------------------------------------------------------- APARTMENT
APT_LOC = 'Site Survey No : 219/A3A1, Ward No : 38, Eastern Side of Pushpagiri School Road, Buddayapalli Area, Chinnachowk Village Field At Kadapa Municipal Corporation of  Y.S.R (Dt).'


def apartment(doc):
    t = doc.tables
    span(doc, 'NGO Colony', 'NGO Colony Branch', 'bankBranchName')
    span(doc, '2605136', '2605136', 'fileNo')
    whole(doc, 'GADIKOTA', '“ ' + T('aptNameUpper') + '” (RESIDENTIAL APARTMENT)')
    whole(doc, 'Cellar + Stilt', T('floorsDesc'))
    whole(doc, 'M/s. VSR Constructions', T('builderName'))
    whole(doc, 'G. Penchala Reddy', T('ownerLine1'))
    whole(doc, '2/32, Nallathimmayapalli', T('owner1Addr'))
    whole(doc, 'Sri G. Krishna Reddy,', T('ownerLine2'))
    whole(doc, '1/105, Nallathimmayapalli', T('owner2Addr'))
    span(doc, 'Applicant :', 'Applicant', 'applicantLabel')
    whole(doc, 'Chengal', T('applicantLine'))
    whole(doc, '38-A', T('applicantAddr'))
    span(doc, 'Net', '725/2022', 'deedNo')
    span(doc, 'Net', '0.91', 'udsCents')
    span(doc, 'Net', '44.44', 'udsYd')
    span(doc, 'Survey No ', '38/168-4-99', 'doorNo')
    span(doc, 'Survey No ', '219/A3A1', 'surveyNo')
    span(doc, 'Plot No’s', '101', 'flatNo')
    span(doc, 'Plot No’s', 'First', 'floorName')
    span(doc, 'Plot No’s', '07,08,09,10 & 11', 'plotNo')
    span(doc, 'Plan', '1013/0322/B/KAD/cch/2022', 'planNo')
    span(doc, 'Plan', '22-04-2022', 'planDate')
    p = find_para(doc, 'Valuation Report of')
    for old, tag in (('Gadikota Heights', 'aptName'), ('101', 'flatNo'), ('First', 'floorName'), ('219/A3A1', 'surveyNo'),
                     ('38', 'wardNo'), ('Eastern Side of The Delhi Public School Road, Buddayapalli Area', 'locationText'),
                     ('Chinnachowk', 'village'), ('Kadapa Municipal Corporation of  Y.S.R (Dt).', 'localBody')):
        replace_span(p, old, T(tag))
    span(doc, 'UN DIV', '44.44', 'udsYd')
    span(doc, 'UN DIV', '1194.66', 'parentYd')
    span(doc, 'Valuation:', '49,50,000', 'fmv')
    span_re(doc, 'FORTY NINE', r'\(RUPEES.*ONLY\)', '=(' + T('fmvWordsUpper') + ')')
    whole(doc, 'KADAPA MUNICIPAL CORPORATION; Y.S.R.', T('localBodyUpper'))
    for loc in ('considered opinion', 'We are satisfied', 'present stage value'):
        p = find_para(doc, loc)
        replace_span(p, '49,50,000', T('fmv'))
        if loc != 'We are satisfied':
            p_span_re(p, r'\((Rs\. Forty Nine[^)]*only)\)', 'fmvWordsRs', group=1)
    p_span_re(find_para(doc, '(Rs. Forty Nine'), r'\((Rs\. Forty Nine[^)]*only)\)', 'fmvWordsRs', group=1)
    p = find_para(doc, 'and  the distress value')
    replace_span(p, '47,00,000', T('realizable'))
    p_span_re(p, r'\((Rupees Forty Seven[^)]*Only)\)', 'realizableWords', group=1)
    replace_span(p, '44,55,000', T('distress'))
    p_span_re(p, r'\((Rupees Forty Four[^)]*only)\)', 'distressWords', group=1)
    p = find_para(doc, 'adopting suitable composite rate')
    replace_span(p, '47,00,000', T('realizable'))
    p_span_re(p, r'\((Rupees Forty Seven[^)]*Only)\)', 'realizableWords', group=1)
    p = find_para(doc, 'forced sale value')
    replace_span(p, '20', T('forcedLessPct'))
    replace_span(p, '44,55,000', T('distress'))
    p_span_re(p, r'\((Rupees Forty Four[^)]*only)\)', 'distressWords', group=1)
    p = find_para(doc, 'Number of title deed')
    for old, tag in (('One', 'deedCountWord'), ('19-01-2022', 'deedDate'), ('725/2022', 'deedNo'),
                     ('G.P.A. Deed M/s VSR Constructions. Managing Directors 1.Sri G. Venkata Subba Reddy, 2. Sri G. Krishna Reddy, ', 'deedNote')):
        replace_span(p, old, T(tag))
    for loc in ('the presence of', 'based upon the request'):
        p = find_para(doc, loc)
        replace_span(p, 'Sankarapuram', T('bankBranchShort'))

    # Additions estimate page (removed when the case has no proposed additions)
    marker_before(doc, 'ADDITIONS WORK', '{{cut:additions}}')
    marker_before(doc, 'The undersigned have inspected', '{{endcut:additions}}')
    span(doc, 'F.NO', '2605136', 'fileNo')
    p = find_para(doc, 'ESTIMATION FOR THE PROPOSED')
    m = re.search(r'“GADIKOTA.*', para_text(p))
    replace_span(p, m.group(0), T('additionsTitleUpper'))
    whole(doc, 'Chengal', T('applicantLine'))
    body = list(doc.paragraphs)
    n = 0
    heading = None
    for par in body:
        tx = para_text(par)
        if 'PROPOSED TO' in tx:
            heading = par
            continue
        if re.search(r'Rs\s*[\d,]+\.00\s*$', tx) and 'TOTAL' not in tx and not tx.strip().startswith('Rs'):
            n += 1
            if heading is not None:          # item description from the case (line disappears when unused)
                m = re.match(r'\s*\d+\)\s*', para_text(heading))
                from docx_tools import set_para_text
                set_para_text(heading, (m.group(0) if m else '') + T(f'ad{n}_desc'))
                heading = None
            m = re.search(r'Rs\s*(\d[\d,]*\.00)\s*$', tx)
            replace_span(par, m.group(1), T(f'ad{n}_amt'))
            m = re.search(r'Rs\s*(\d[\d,]*)(/-)?', para_text(par))
            if m and '{{' not in m.group(0):
                replace_span(par, m.group(1), T(f'ad{n}_rate'))
            m = re.match(r'\s*(.*?)\s{2,}Rs', para_text(par))
            if m and m.group(1).strip():
                replace_span(par, m.group(1).strip(), T(f'ad{n}_qty'))
    span(doc, 'TOTAL=', '10,05,000', 'adTotal')
    whole(doc, ' Rs 10,05,000.00', ' Rs ' + T('adTotal') + '.00')
    span_re(doc, 'TEN ', r'\(RUPEES.*ONLY\)', '=(' + T('adWordsUpper') + ')')

    a = t[0]
    for r, key in ((0, 'purpose'), (1, 'inspectionDate'), (2, 'valuationDate'), (7, 'mvCertificate'), (8, 'briefDescription'),
                   (10, 'surveyLine'), (11, 'flatLine'), (12, 'villageLine'), (13, 'wardLine'), (15, 'layoutLine'),
                   (16, 'planAuthority')):
        cell(a, r, 3, key)
    cell(a, 3, 3, 'applicantLabelCell', 'applicantName', 'applicantRelLine', 'applicantAddr')
    cell(a, 5, 3, '=Sale  Deed No : ', 'deedLineShort')
    cell(a, 6, 3, '=B.A. NO. ' + T('planNo') + '   ', '=Dt : ' + T('planDate'))
    cell(a, 14, 3, '=' + T('localBodyName') + ' of ', '=' + T('district') + ' (Dt).')
    cell(a, 17, 3, 'planVerified', '', 'planComments')
    b = t[1]
    for r, key in ((1, 'cityTown'), (2, 'areaResidential'), (3, 'areaCommercial'), (4, 'areaIndustrial'), (5, 'areaClass'),
                   (6, 'localBodyType'), (7, 'govtEnactments'), (24, 'totalExtentSummary')):
        cell(b, r, 3, key)
    cell(b, 0, 3, '=“' + T('aptName') + '” Apartments, ', 'flatDescription')
    for r, side in ((9, 'North'), (10, 'South'), (11, 'East'), (12, 'West')):
        cell(b, r, 3, f'bdDeed{side}')
    for r, side in ((14, 'North'), (15, 'South'), (16, 'East'), (17, 'West')):
        cell(b, r, 3, f'fb{side}')
    cell(b, 18, 3, 'deed1Header')
    cell(b, 18, 4, 'deed2Header')
    for r, side in ((19, 'North'), (20, 'South'), (21, 'East'), (22, 'West')):
        cell(b, r, 3, f'dimDeed{side}')
        cell(b, r, 4, f'dim2{side}')
    cell(b, 23, 3, 'deed1ExtentLine')
    cell(b, 23, 4, 'deed2ExtentLine')
    c = t[2]
    for r in (1, 2, 3, 4, 5, 8):
        cell(c, r, 3, 'udsOutOf')
    cell(c, 6, 4, '=' + T('latitude') + ',')
    cell(c, 7, 4, 'longitude')
    cell(c, 9, 3, 'occupancy')
    d = t[3]
    for r, key in ((0, 'aptNature'), (1, 'flatLine'), (2, 'aptNameLine'), (3, 'flatPostal'), (5, 'surveyLine'), (6, 'blockNo'),
                   (7, 'wardLocLine'), (8, 'villageLbLine'), (9, 'areaLine'), (10, 'localityDesc'), (11, 'yearOfConstruction'),
                   (12, 'ageLine'), (13, 'remainingLifeLine'), (14, 'totalLifeLine'), (15, 'floorsShort'), (16, 'structure'),
                   (17, 'unitsLine'), (18, 'quality'), (19, 'appearance'), (20, 'maintenance'), (22, 'lift'),
                   (23, 'protectedWater'), (24, 'sewerage'), (25, 'carParking'), (26, 'carParkingType'), (27, 'compoundWall'),
                   (28, 'pavement'), (29, 'otherFacility')):
        cell(d, r, 3, key)
    e = t[4]
    for r, key in ((0, 'floorLine'), (1, 'flatNoLine'), (3, 'specRoof'), (4, 'specFlooring'), (5, 'specDoors'),
                   (6, 'specWindows'), (7, 'specFittings'), (8, 'specFinishing'), (9, 'houseTax'), (10, 'assessmentNo'),
                   (11, 'taxAmountLine'), (12, 'taxPaidName'), (13, 'electricityNo'), (14, 'meterName'),
                   (15, 'flatMaintenance'), (16, 'deedExecutant'), (17, 'udsCentsLine'), (18, 'plinthLine'), (19, 'fsi'),
                   (20, 'carpetLine'), (21, 'flatClass'), (22, 'usage'), (23, 'occupancy2'), (24, 'monthlyRent')):
        cell(e, r, 3, key)
    for r, key in ((0, 'marketability'), (1, 'advantages'), (2, 'negatives')):
        cell(t[6], r, 3, key)
    g = t[7]
    for r, key in ((0, 'comparableRate'), (1, 'adoptedBasicRate'), (3, 'buildingCalc'), (5, 'guidelineNote')):
        cell(g, r, 3, key)
    cell(g, 4, 3, 'landCalc1', 'landCalc2')
    h = t[8]
    for r, key in ((1, 'replacementLine'), (2, 'ageLine'), (3, 'lifeLine'), (4, 'deprPctLine'), (5, 'deprAmountLine'),
                   (6, 'deprValueLine'), (8, 'deprBuildingLine'), (9, 'landValueLine'), (10, 'compositeLine')):
        cell(h, r, 3, key)
    k = t[9]
    cell(k, 1, 2, 'plinthLine')
    cell(k, 1, 3, 'unitRateLine')
    cell(k, 1, 4, 'compositeLine')
    cell(k, 2, 3, 'carParkingRate')
    for r, key in ((2, 'x_carParking'), (3, 'x_wardrobes'), (4, 'x_showcases'), (5, 'x_kitchen'), (6, 'x_superfine'),
                   (7, 'x_interior'), (8, 'x_deposits'), (9, 'x_electrical'), (10, 'x_grills'), (11, 'x_potential'),
                   (12, 'x_commonAmenities')):
        cell(k, r, 4, key)
    cell(k, 13, 4, 'grandTotalLine', 'sayLine')
    cell(k, 14, 3, 'plusFactors')
    cell(k, 15, 3, 'minusFactors')
    cell(k, 16, 3, 'presentValueLine')
    m = t[10]
    cell(m, 1, 2, 'declBackground')
    cell(m, 2, 2, 'declPurpose')
    cell(m, 5, 2, 'declDates1', 'declDates2', 'declDates3')

    span(doc, 'personally  inspected', '28-05-2026', 'inspectionDate')
    span(doc, 'was inspected', '28-05-2026', 'inspectionDate')
    replace_all_body(doc, '29-05-2026', 'reportDate')
    places(doc)
    mark_region(doc, 'LOCATION MAP', 'PHOTO’S', '{{img:areaMap:5943600:4114800}}')
    mark_images(doc, 'PHOTO’S', 'photo', stop_text='Google Map')
    mark_images(doc, 'Google Map', 'gmap')


# --------------------------------------------------------------------------- OPEN SITE
SITE_SV = '45-4, 46-5, 45-5A, 45-5B, 46-6A, 46-6B'
SITE_LOC = '“ M/s. Dream Nest Makers Infra – Style Of Gagan Vihar Country Community”, In Rudrabharathipeta'


def photo_slots(doc, contains, count=6, w=2651760, h=1988820):
    """Replace a '{{…PHOTOS[]}}' placeholder paragraph with photo slots, two per line."""
    from copy import deepcopy
    from docx.text.paragraph import Paragraph
    p = find_para(doc, contains)
    from docx_tools import set_para_text
    set_para_text(p, ' '.join('{{img:photo%d:%d:%d}}' % (i, w, h) for i in (1, 2)))
    anchor = p
    for start in range(3, count + 1, 2):
        el = deepcopy(anchor._p)
        anchor._p.addnext(el)
        anchor = Paragraph(el, p._parent)
        set_para_text(anchor, ' '.join('{{img:photo%d:%d:%d}}' % (i, w, h) for i in (start, start + 1) if i <= count))
    # one picture per run so each slot can be filled on its own
    for par in [p] + [Paragraph(e, p._parent) for e in []]:
        pass


def split_runs(doc):
    """Image markers must each sit in their own run."""
    import copy as cp
    for par in doc.paragraphs:
        for run in list(par.runs):
            parts = re.findall(r'\{\{img:[^}]+\}\}', run.text)
            if len(parts) > 1:
                run.text = parts[0]
                prev = run._r
                for extra in parts[1:]:
                    sp = cp.deepcopy(run._r)
                    for t in sp.findall('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t'):
                        t.text = ''
                    prev.addnext(sp)
                    from docx.text.run import Run
                    r2 = Run(sp, par)
                    r2.text = '  ' + extra
                    prev = sp


def open_site(doc):
    t = doc.tables
    span(doc, 'RAH ', 'RAH Branch', 'bankBranchName')
    whole(doc, '{{ENGINEER_NAMES}}', 'Canara Bank, ' + T('bankBranchName') + ',\t    ' + T('staffInitials'))
    span(doc, '2605110', '2605110', 'fileNo')
    span(doc, T('fileNo'), '7 Roads, Kadapa, Y.S.R (Dt).', 'branchPlace')
    span(doc, 'Kiran Kumar', 'Sri. A. Kiran Kumar Reddy', 'owner1Name')
    span(doc, 'Janardhan', 'S/o. Sri. A. Janardhan Reddy', 'owner1Rel')
    span_re(doc, 'Bayanapalle', r'Door No :.*\(Dt\)\.', 'owner1Addr')
    span(doc, 'Applicant :-', 'Applicant', 'applicantLabel')
    span(doc, 'Srinath', 'Sri. O. Sri Sai Srinath Reddy', 'applicantName')
    span(doc, 'Ramana Reddy', 'S/o. Sri. O. Ramana Reddy', 'applicantRel')
    span_re(doc, 'Pakkirupalle', r'Door No :.*\(Dt\)\.', 'applicantAddr')
    span(doc, 'Extent  ', '10169/2025', 'deedNo')
    span(doc, 'Extent  ', '3.819', 'consideredCents')
    span(doc, 'Plot No', '9', 'plotNo')
    span(doc, SITE_SV, SITE_SV, 'surveyNo')
    p = find_para(doc, 'Valuation Report of')
    for old, tag in (('Residential Vacant Site', 'siteType'), (SITE_SV, 'surveyNo'), ('9', 'plotNo'), ('112', 'wardNo'),
                     (SITE_LOC, 'locationText'), ('Rudrabharathipeta', 'village'),
                     ('Kadapa Municipal Corporation Of Y.S.R. (Dt).', 'localBody')):
        replace_span(p, old, T(tag))
    whole(doc, '         Kadapa Municipal Corporation of Y.S.R (DT).', T('localBodyLine'))
    tb_span(doc, 'VALUATION :', r'25,00,000', 'fmv')
    tb_span(doc, 'TWENTY FIVE', r'\(RUPEES.*Only\)', '(' + T('fmvWordsUpper') + ')')
    p = find_para(doc, 'considered opinion')
    replace_span(p, '25,00,000', T('fmv'))
    p_span_re(p, r'\((Rupees Twenty Five[^)]*Only)\)', 'fmvWords', group=1)
    replace_span(p, '22,50,000', T('realizable'))
    p_span_re(p, r'\((Rupees Twenty Two[^)]*Only)\)', 'realizableWords', group=1)
    replace_span(p, '20,00,000', T('distress'))
    p_span_re(p, r'\((Rupees Twenty Lakhs[^)]*)\)', 'distressWords', group=1)
    span(doc, 'Adopting prevailing market', '25,00,000', 'fmv')
    span(doc, 'Present market value.', '20,00,000', 'distress')
    span(doc, 'estimated as 20% less', '20', 'forcedLessPct')
    span(doc, 'Number of title deed', 'One', 'deedCountWord')
    p = find_para(doc, 'with Registration Number')
    for old, tag in (('26-12-2025', 'deedDate'), ('10169/2025', 'deedNo'), ('Cuddapah (R.O)', 'sroName')):
        replace_span(p, old, T(tag))
    p = find_para(doc, 'The property was inspected on')
    replace_span(p, '22-05-2026', T('inspectionDate'))
    replace_span(p, 'RAH Branch, Seven Roads, Kadapa City, Y.S.R  (Dt).', T('bankBranchLine'))
    span(doc, 'The request from', 'RAH Branch, Seven Roads, Kadapa City, Y.S.R  (Dt).', 'bankBranchLine')

    a = t[0]
    for i, (key, suf) in enumerate((('owner1Name', ', '), ('owner1Rel', '.'), ('owner1Addr', ''), ('applicantLabel', ' :-'),
                                    ('applicantName', ', '), ('applicantRel', '.'), ('applicantAddr', '')), start=1):
        set_cell_para(a, 0, 5, i, ('      ' if 'Name' in key or 'Rel' in key else ' ') + T(key) + suf)
    for r, key in ((1, 'purpose'), (2, 'valuationDate'), (3, 'inspectionDate'), (5, 'deedLine'), (6, 'mvCertificate'),
                   (8, 'plotLine'), (10, 'villageLine'), (11, 'wardLine'), (12, 'localBodyComma'), (13, 'postalAddress')):
        cell(a, r, 5, key)
    cell(a, 9, 5, 'surveyLine')
    for r, side in ((15, 'North'), (16, 'South'), (17, 'East'), (18, 'West')):
        cell(a, r, 3, f'bdDeed{side}')
        cell(a, r, 6, f'bdActual{side}')
    for r, side in ((21, 'North'), (22, 'South'), (23, 'East'), (24, 'West')):
        cell(a, r, 3, f'dimDeed{side}')
        cell(a, r, 6, f'dimActual{side}')
    cell(a, 25, 3, 'extentDeed')
    cell(a, 25, 6, 'extentActual')
    for r, key in ((26, 'extentDeed'), (27, 'extentActual'), (28, 'netExtentPlan'), (29, 'extentConsidered')):
        cell(a, r, 3, key)
    chars = ['locality', 'localityClass', 'surroundings', 'flooding', 'civicAmenities', 'levelOfLand', 'landShape',
             'landUse', 'usageRestriction', 'tenure', 'layoutApproved', 'approvalProblem', 'cornerPlot', 'depthRatio',
             'roadFacilities', 'roadType', 'roadWidth', 'landLocked', 'water', 'sewerage', 'power', 'advantage1',
             'disadvantage1']
    for i, key in enumerate(chars):
        cell(t[1], i, 3, key)
    b = t[2]
    cell(b, 1, 3, 'guidelineRateLine')
    cell(b, 2, 1, '=Value of land by adopting GLT', '=(' + T('consideredYd') + ' Sqyds X Rs ' + T('guideRate') + '/-)')
    cell(b, 2, 3, 'glrLandLine')
    cell(b, 4, 3, 'marketRateLine')
    cell(b, 5, 3, 'landValueLine')
    for para in b.rows[5].cells[1].paragraphs:
        if '3.819' in para_text(para):
            replace_span(para, '3.819', T('consideredCents'))
            replace_span(para, '6,55,000', T('marketRate'))
    for r, key in enumerate(['ex_compoundWall', 'ex_bore', 'ex_water', 'ex_power', 'extrasTotal'], start=1):
        cell(t[3], r, 3, key)
    m = t[4]
    for r, (glr, pmr) in ((2, ('glrLand', 'pmrLand')), (3, ('glrExtras', 'pmrExtras')), (4, ('glrTotal', 'pmrTotal')),
                          (5, ('glrTotal', 'pmrSay'))):
        cell(m, r, 2, glr)
        cell(m, r, 3, pmr)
    cell(m, 6, 3, 'plusFactors')
    cell(m, 7, 3, 'minusFactors')
    cell(m, 8, 3, 'presentValueLine')
    n = t[5]
    cell(n, 1, 2, 'declBackground')
    cell(n, 2, 2, '=For Collateral Security. Canara Bank, ', 'bankBranchLine')
    cell(n, 5, 2, 'declDates1', 'declDates2', 'declDates3')

    replace_all_body(doc, '22-05-2026', 'reportDate')
    places(doc)
    whole(doc, '{{LOCATION_MAP_IMAGE}}', '{{img:areaMap:5943600:4114800}}')
    photo_slots(doc, '{{SITE_INSPECTION_PHOTOS[]}}', 6)
    whole(doc, '{{GOOGLE_MAP_IMAGES[]}}', '{{img:map1:5943600:4114800}}')
    whole(doc, '{{LATITUDE_DMS}}', T('gpsDms') + '\n' + T('gpsDecimal'))
    split_runs(doc)


# --------------------------------------------------------------------------- AGRICULTURE (90% / 80%)
AG_LOC = 'Eguva Nelaturu Village, Diguva Nelaturu Grama Panchayath, Eguva Nelaturu Village Field '


def agriculture(doc):
    t = doc.tables
    span(doc, 'File No', '2602048', 'fileNo')
    whole(doc, 'Porumamilla Branch,', T('bankBranchName') + ',')
    whole(doc, 'Porumamilla, Y.S.R', T('branchPlace'))
    span(doc, 'Madhavi', 'Smt. B. Madhavi', 'owner1Name')
    span(doc, 'Sudhakar Naidu', 'W/o. Sri. B. Sudhakar Naidu', 'owner1Rel')
    span_re(doc, 'Kammavaripalle Village, Dirasavancha', r'Kammavaripalle.*\)\.', 'owner1Addr')
    span(doc, '83309 85233', '83309 85233', 'ownerPhone')
    p = find_para(doc, 'Valuation Report of')
    for old, tag in (('69-1', 'surveyNo'), ('380', 'khathaNo'), ('411', 'lpNo'), (AG_LOC, 'locationText'),
                     ('Brahmamgarimattam Mandal of Y.S.R. (Dt).', 'localBody')):
        replace_span(p, old, T(tag))
    span(doc, 'Valuation:', '13,40,000', 'fmv')
    span_re(doc, 'THIRTEEN', r'\(RUPEES.*ONLY\)', '=(' + T('fmvWordsUpper') + ')')
    whole(doc, 'Diguva Nelaturu Grama Panchayath, Brahmamgarimattam Mandal,', T('localBodyLine'))
    p = find_para(doc, 'considered opinion')
    replace_span(p, '13,40,000', T('fmv'))
    p_span_re(p, r'\((Rupees Thirteen[^)]*Only)\)', 'fmvWords', group=1)
    p = find_para(doc, 'Twelve')
    replace_span(p, '12,06,000', T('realizable'))
    p_span_re(p, r'\((Rupees Twelve[^)]*Only)\)', 'realizableWords', group=1)
    p = find_para(doc, 'Seventy Two Thousand')
    replace_span(p, '10,72,000', T('distress'))
    p_span_re(p, r'\((Rupees Ten[^)]*Only)\)', 'distressWords', group=1)
    p = find_para(doc, 'adopting prevailing market rate for land')
    replace_span(p, '13,40,000', T('fmv'))
    p_span_re(p, r'\((Rupees Thirteen[^)]*Only)\)', 'fmvWords', group=1)
    span(doc, 'estimated as 20 %', '20', 'forcedLessPct')
    p = find_para(doc, 'Ten Lakhs Seventy Two')
    replace_span(p, '10,72,000', T('distress'))
    p_span_re(p, r'\((Rupees Ten[^)]*Only)\)', 'distressWords', group=1)
    span(doc, 'Number of title deed', 'One', 'deedCountWord')
    p = find_para(doc, 'registered in the')
    for old, tag in (('1478/2021', 'deedNo'), ('06-04-2021', 'deedDate'), ('Badvel', 'sroName')):
        replace_span(p, old, T(tag))
    for loc in ('in the presence of Manager', 'from The Manager, Canara Bank'):
        p = find_para(doc, loc)
        m = re.search(r'Porumamilla.*\)\.', para_text(p))
        replace_span(p, m.group(0), T('bankBranchLine'))
    span(doc, 'Date   :  Kadapa', 'Kadapa', 'reportDate')
    span(doc, 'Place  :  11-02-2026', '11-02-2026', 'place')

    # Land development estimate page (only when the case has development items)
    from make_templates_boi import marker_before
    marker_before(doc, 'ESTIMATION FOR THE LAND DEVELOPMENT', '{{cut:development}}')
    marker_before(doc, 'The undersigned have inspected', '{{endcut:development}}')
    replace_span(find_para(doc, '88,000'), '88,000', T('dev0'))
    for par in doc.paragraphs:
        while '3.35 Acres' in para_text(par):
            replace_span(par, '3.35 Acres', T('totalAcStr') + ' Acres')
    for old, tag in (('Rs 2,25,000', 'dev1'), ('Rs 2,10,000', 'dev2'), ('Rs 2,75,000', 'dev3'), ('Rs 4,52,000', 'dev4')):
        p = find_para(doc, old.replace('Rs ', ''))
        replace_span(p, old.replace('Rs ', ''), T(tag))
    span(doc, 'Total               =', '12,50,000', 'devTotal')
    span(doc, 'Say  As', '12,50,000', 'devTotal')
    span_re(doc, 'TWELVE LAKHS FIFTY', r'\( RUPEES.*ONLY\)', '=( ' + T('devWordsUpper') + ')')
    p = find_para(doc, 'Abstract  and detailed estimation')
    m = re.search(r'69-1.*', para_text(p))
    replace_span(p, m.group(0), T('devLocation'))
    span_re(doc, 'Belongs To :-    Smt', r'Smt\. B\. Madhavi.*', 'ownerLine1')

    a = t[0]
    cell(a, 1, 0, 'khathaNo', 'lpNoLine')
    cell(a, 1, 1, 'deedNo')
    cell(a, 1, 2, 'surveyNo')
    cell(a, 1, 3, 'extentLine')
    cell(a, 2, 3, 'extentLine')
    b = t[1]
    set_cell_para(b, 0, 5, 1, T('owner1Name') + ', ')
    set_cell_para(b, 0, 5, 2, T('owner1Rel') + '.')
    set_cell_para(b, 0, 5, 3, T('owner1Addr') + ' ' + T('ownerPhoneLine'))
    for r, key in ((1, 'purpose'), (2, 'valuationDate'), (3, 'inspectionDate'), (6, 'planLine'), (7, 'mvCertificate'),
                   (9, 'khathaLine'), (10, 'nagarLine'), (11, 'surveyLine'), (12, 'villageBlock'), (13, 'wardLine'),
                   (14, 'mandalLine'), (15, 'postalAddress')):
        cell(b, r, 5, key)
    cell(b, 5, 5, 'khathaLine', 'deedLine')
    for r, side in ((18, 'East'), (19, 'West'), (20, 'North'), (21, 'South')):
        cell(b, r, 3, f'bdDeed{side}')
        cell(b, r, 5, f'bdActual{side}')
    c = t[2]
    for r in (2, 3, 4, 5, 6):
        cell(c, r, 3, 'extentLine3')
        cell(c, r, 5, 'extentLine3')
    cell(c, 7, 1, '=Total Extent  : ' + T('extentLine3'))
    cell(c, 8, 5, 'extentLine3')
    cell(c, 9, 5, 'extentLine3')
    chars = ['locality', 'localityClass', 'surroundings', 'flooding', 'civicAmenities', 'levelOfLand', 'landShape',
             'landUse', 'usageRestriction', 'tenure', 'layoutApproved', 'approvalProblem', 'cornerPlot', 'depthRatio',
             'roadFacilities', 'roadType', 'roadWidth', 'landLocked', 'water', 'sewerage', 'power', 'advantage1',
             'disadvantage1']
    for i, key in enumerate(chars):
        cell(t[3], i, 3, key)
    cell(t[4], 0, 3, '', '', 'guidelineRateLine', '', '', 'glrLandLine')
    for tbl, rate in ((t[4], '1,80,000'), (t[5], '4,00,000')):
        for para in tbl.rows[0].cells[1].paragraphs:
            tx = para_text(para)
            if '3.350' in tx:
                replace_span(para, '3.350', T('totalAc3'))
            if rate in para_text(para):
                replace_span(para, rate, T('guideRateAcre' if rate == '1,80,000' else 'marketRateAcre'))
    cell(t[5], 0, 3, '', '', '', '', '', 'marketRateLine', '', '', '', 'landValueLine')
    m = t[6]
    for r, (glr, pmr) in ((2, ('glrLand', 'pmrLand')), (6, ('glrLand', 'pmrTotal')), (7, ('glrLand', 'pmrSay'))):
        cell(m, r, 2, glr)
        cell(m, r, 3, pmr)
    cell(m, 10, 3, 'presentValueLine')
    n = t[7]
    cell(n, 1, 2, 'declBackground')
    cell(n, 2, 2, 'declPurpose')
    cell(n, 5, 2, 'declDates1', 'declDates2', 'declDates3')

    span(doc, 'The property was inspected on', '11-02-2026', 'inspectionDate')
    span(doc, 'personally inspected', '11-02-2026', 'inspectionDate')
    replace_all_body(doc, '11-02-2026', 'reportDate')
    places(doc)
    whole(doc, '14°45', T('gpsDms'))
    whole(doc, '14.759389, 78.953667', T('gpsDecimal'))
    mark_images(doc, 'PHOTO’S', 'photo', stop_text='LOCATION – MAP')
    mark_region(doc, 'LOCATION – MAP', 'GOOGLE - MAP', '{{img:areaMap:5943600:4114800}}')
    mark_images(doc, 'GOOGLE - MAP', 'map')
    mark_images(doc, T('gpsDecimal'), 'extra', stop_text='Neelakanta')


FORMATS = {'house': house, 'apartment': apartment, 'open_site': open_site, 'agriculture': agriculture}

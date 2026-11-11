"""
Central Bank of India report builder (the bank's own formats in cbi_source/).

CBI's rules, read from the bank's sample reports:
  • "Say" = the total rounded down to ₹10,000 (25,34,002 → 25,30,000), unless the engineer types it
  • Realizable / distress = % of the Say (Settings → Banks: house/site 90/80, flat 95/90), rounded to the
    nearest ₹1,000 (25,30,000 → 22,77,000; 66,17,000 → 59,55,000)
  • Building depreciation 1% per year of age
The building and extras sums are shared with the Bank of Baroda builder (same valuer's method).
"""
import os
import re

import apgb
import bob
from apgb import inr, num, trunc2, SQYD_PER_CENT, SQM_PER_CENT, SQFT_PER_SQM, apply_overrides
from union import core_words, dotted, cents_txt
from pnb import owner_fields

HERE = os.path.dirname(os.path.abspath(__file__))
DROP = bob.DROP

HOUSE_EXTRAS = {
    'partC': ['ex_portico', 'ex_frontDoor', 'ex_sitOut', 'ex_ohTank', 'ex_gates'],
    'partD': ['am_wardrobes', 'am_glazedTiles', 'am_sinks', 'am_marble', 'am_interior', 'am_elevation',
              'am_paneling', 'am_aluminium', 'am_handRails', 'am_falseCeiling'],
    'partE': ['mi_toilet', 'mi_lumber', 'mi_sump'],
    'partF': ['sv_water', 'sv_drainage', 'sv_compoundWall', 'sv_cbDeposits', 'sv_pavement'],
}
HOUSE_DEFAULTS = {
    'purpose': 'To Ascertain Present Market Value ', 'cityTown': 'Kadapa City', 'areaResidential': 'Residential Area',
    'areaClass': 'Middle', 'areaUrban': 'Urban', 'govtEnactments': 'No', 'agriConversion': 'No', 'occupancy': 'Owners',
    'locality': 'Residential area', 'surroundings': 'Developing Area', 'flooding': 'No',
    'civicAmenities': 'Available near by', 'levelOfLand': 'Plain', 'landShape': 'Rectangular',
    'landUse': 'Residential  Purpose', 'usageRestriction': 'No', 'layoutApproved': 'No', 'cornerPlot': 'Intermittent plot',
    'roadFacilities': 'Available', 'roadType': 'CC Road', 'roadWidth': 'Above 20’0” Wide Road', 'landLocked': 'No',
    'water': 'Yes', 'sewerage': 'Yes', 'power': 'Yes', 'advantage1': 'The Property is Located In Residential  Area',
    'disadvantage1': 'No', 'disadvantage2': 'No', 'specialRemarks': 'Nil', 'buildingType': 'Residential',
    'constructionType': 'Framed Structure', 'specGF_foundation': 'Isolated Footings', 'specGF_basement': 'R.R. Masonry',
    'specGF_superstructure': 'Brick Masonry', 'specGF_joinery': 'Country Wood', 'specGF_rccWorks': 'Footings, Columns, Beams',
    'specGF_plastering': 'C.M', 'specGF_flooring': 'Tiles', 'specGF_specialFinish': 'Nil', 'specGF_roofing': 'Nil',
    'specGF_drainage': 'UDS', 'legalOpinion': ' ', 'district': 'Y.S.R', 'place': 'Kadapa',
}
BANK = {'label': 'Central Bank Of India', 'realizable': 0.90, 'distress': 0.80, 'say_step': 10000,
        'site_say_step': 1000, 'value_round': 1000, 'pct_of': 'say', 'extras': HOUSE_EXTRAS,
        'defaults': {'house': HOUSE_DEFAULTS}}


def applicant(f, rep):
    app, rel = rep.get('applicantName'), bob.relation(rep.get('applicantRel'))
    f.update({
        'applicantLabel': '  Applicant :' if app else DROP,
        'applicantLine': f'{app},  {rel.rstrip(".")}.' if app and rel else (app or DROP),
        'applicantName': f'{app}, ' if app else DROP, 'applicantRel': f'{rel.rstrip(".")}.' if app and rel else DROP,
        'applicantAddr': (rep.get('applicantAddr') or DROP) if app else DROP,
    })


def common(f, case, rep):
    say = num(f['fmv'])
    f.update({'districtDotted': dotted(f['district']), 'fmvWordsCore': core_words(say),
              'fmvWordsCoreUpper': core_words(say).upper().replace('CRORES', 'CRORE'),
              'declDates1': f'Date of appointment: {f["inspectionDate"]} ', 'declDates2': f'Valuation date : {f["reportDate"]}. ',
              'declDates3': f'Date of report  : {f["reportDate"]}.',
              'declPurpose': f'For collateral security. Manager, Central Bank Of India, {(case.get("bankBranch") or "---").strip()}, {dotted(f["district"])}. (Dt).'})


def yd_c(c):
    return f'{trunc2(c * SQYD_PER_CENT):.2f} Sqyds (or) {cents_txt(c)} Cents'


def sqm_c(c):
    return f'{trunc2(c * SQM_PER_CENT):.2f} Sqmts (or) {cents_txt(c)} Cents'


def build_house(case, temps, bank=None):
    job = bob.build_house(case, temps, bank=BANK)
    f = job['fields']
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    owner_fields(f, case, rep)
    applicant(f, rep)
    survey, door, ward = f['surveyNo'] or '---', f['doorNo'] or '---', f['wardNo']
    lb, district = f['localBodyName'], f['district']
    near = rep.get('nearBy')
    deed_c = apgb.extent_in_cents(rep.get('extentDeedRaw') or pd.get('netExtent'))
    plan_c = apgb.extent_in_cents(rep.get('netExtentPlanRaw')) or deed_c
    considered = min(x for x in (deed_c, plan_c) if x) if (deed_c or plan_c) else 0
    rate = num(rep.get('marketRatePerCent')) or num(pd.get('landRate')) * SQYD_PER_CENT
    guide = num(rep.get('guidelineRatePerSqyd')) or num(pd.get('guidelineRate'))
    land = apgb.money(considered * rate)
    age = int(num(pd.get('buildingAge')))
    life = int(num(rep.get('totalLife'), 60)) or 60

    codes, actual, plan = [], [], []
    for i, row in enumerate(job['rows']['fl'], start=1):
        area = num(row['plinth'])
        code = next((v for k, v in bob.FLOOR_CODES.items() if k in row['label'].lower()), row['label'])
        codes.append(code)
        dotted_code = '.'.join(code) if len(code) == 2 else code
        actual.append(f'{dotted_code} = {area:.2f} Sqft')
        plan.append(f'{dotted_code} = {trunc2(area / SQFT_PER_SQM):.2f} Sqmts (or) {area:.2f} Sqft')
        fl_rate = num(re.sub(r'[^\d.]', '', row['rate']))
        row.update({'snoDot': f'{i}.', 'label': row['label'].title(), 'height': rep.get('floorHeight') or '10’0”',
                    'age': f'{age} Y', 'rateSqft': f'Rs {int(fl_rate)}/ Sqft', 'depAmount': row['depAmount'].replace('Rs. ', 'Rs ')})
    floors = '+'.join(codes) or 'GF'
    loc = (f'Site Survey No : {survey}, Door No: {door}, Ward No: {ward}, {f["landmark"]},'
           + (f' Near {near},' if near else '') + f'  {f["village"]} Village Field At {lb} of {dotted(district)} (Dt).')
    deed_line = yd_c(deed_c)
    f.update({
        'houseTitle': f'{rep.get("buildingKindTitle") or "Residential Building"} ({floors}) In {loc}',
        'localBodyLine': f'{lb} ; {dotted(district)} (Dt).', 'netExtentCents': cents_txt(considered),
        'deedLine': f'1)Deed No :  {f["deedNo"] or "---"}, Dt:  {f["deedDate"]}.',
        'planLine': f'B.A.No.{f["planNo"]},  Dt : {f["planDate"]}.' if f['planNo'] != 'NA' else 'NA',
        'briefDesc': rep.get('briefDesc') or 'Land & Building (Residential)',
        'buildingDesc': rep.get('buildingDesc') or f'The Building consist of Residential Building – {floors}, R.C.C Framed structure with brick masonry – R.C.C Roof.',
        'villageLine': f'{f["village"]} Village Field', 'wardLine': f'Ward No: {ward}, {f["landmark"]},',
        'landmarkLine': f'Near {near}, ' if near else ' ', 'localBodyLine2': f'{lb} Of {dotted(district)}. (Dt).',
        'postalLine': f'In {loc}', 'localBodyType': f'Municipal Corporation Limit, {dotted(district)}. (Dt).',
        'bd2Head': 'As Per Actual', 'dim2Head': 'As Per Actual',
        'item1Extent': deed_line, 'item2Extent': deed_line,
        'extentDeedLine': deed_line, 'extentActualLine': deed_line, 'extentPlanLine': sqm_c(plan_c),
        'extentConsideredLine': sqm_c(considered), 'rentLine': 'Rs 0.00/-',
        'sizeNorthSouth': deed_line, 'sizeEastWest': deed_line, 'totalExtent': deed_line,
        'marketRateLine': f'Rs {inr(rate)}/- cent', 'guidelineRateLine': f'Rs {inr(guide)}/- Sqyd' if guide else '---',
        'landCalc': f' {cents_txt(considered)} Cents X Rs {inr(rate)}/- per Cent', 'landCalc2': f'= Rs {inr(land)}/-',
        'ageLine': f'{age} Years', 'remainingLifeLine': f'{max(life - age, 0)} Years',
        'floorsLine': rep.get('floorsLine') or floors,
        'plinthActualLines': '\n'.join(actual) or '---', 'plinthPlanLines': '\n'.join(plan) or '---',
    })
    bd_act = pd.get('boundariesActual') or {}
    for side in ('North', 'South', 'East', 'West'):
        f[f'bd2{side}'] = bd_act.get(side.lower()) or f[f'bdDeed{side}']
        f[f'dim2{side}'] = f[f'dimActual{side}']
    parts = {}
    for part, keys in HOUSE_EXTRAS.items():
        tot = 0
        for k in keys:
            v = num(rep.get(k))
            tot += v
            f[k] = f'Rs {inr(v)}/-' if v else '--'
        parts[part] = tot
        f[part] = f'Rs {inr(tot) if tot else "0.00"}/-'
    building = num(re.sub(r'[^\d.]', '', f['buildingTotalLine']))
    total = land + building + sum(parts.values())
    f.update({
        'absA': f'Rs   {inr(land)}/-', 'absB': f'Rs    {inr(building)}/-',
        **{k: f'Rs   {inr(parts[p]) if parts[p] else "0.00"}/-'
           for k, p in (('absC', 'partC'), ('absD', 'partD'), ('absE', 'partE'), ('absF', 'partF'))},
        'absTotal': f'Rs  {inr(total)}/-', 'absSayAs': f'Rs  {f["fmv"]}/-',
        'declBackground': f'{cents_txt(considered)} Cents of freehold land belonging to the client. The land bearing {loc}',
    })
    common(f, case, rep)
    apply_overrides(f, rep)
    return job


# ---------------------------------------------------------------- APARTMENT
def build_apartment(case, temps, bank=None):
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    defaults = {**HOUSE_DEFAULTS, 'occupancy': 'Occupied by Owner', 'specGF_foundation': 'Framed Structure',
                'specGF_rccWorks': 'R.C.C Roof', 'specGF_flooring': 'Marble', 'cornerPlot': 'Intermittent Plot',
                'guidelineNote': 'Copy Enclosed', 'taxReceiptLine': ' ', 'advantage2': ' '}
    f = apgb.common_fields(case, rep, defaults)
    bob.owners(f, case, rep)
    owner_fields(f, case, rep)
    district = f['district']
    lb = rep.get('localBodyName') or 'Kadapa Municipal Corporation'
    village, ward, landmark = rep.get('village') or '---', rep.get('wardNo') or pd.get('wardNo') or '---', rep.get('landmark') or '---'
    apt = rep.get('aptName') or pd.get('apartmentName') or '---'
    flat = pd.get('flatNo') or rep.get('flatNo') or '---'
    floor = apgb.floor_word(rep.get('floorName') or pd.get('floorNo'))
    ordinal = bob.ORDINAL_SHORT.get(floor, floor)
    ordinal = 'Ground' if ordinal == 'G' else ordinal
    survey, door = f['surveyNo'] or '---', f['doorNo'] or '---'
    uds_c = apgb.extent_in_cents(rep.get('udsDeedRaw') or pd.get('netExtent'))
    parent_c = apgb.extent_in_cents(rep.get('parentExtentDeedRaw'))
    rate = num(rep.get('ratePerCent')) or num(rep.get('marketRatePerCent')) or num(rep.get('landRatePerSqyd')) * SQYD_PER_CENT
    land = apgb.money(uds_c * rate)
    plinth = apgb.sqft_of(rep.get('plinthArea')) or sum(num(x.get('value')) for x in ((pd.get('siteValue') or {}).get('floors') or []))
    c_rate = num(rep.get('constructionRate')) or 1850
    age = int(num(pd.get('buildingAge')))
    dep_pct = min(age * num(rep.get('depreciationPerYear'), 1.0), 70.0)
    repl = apgb.money(plinth * c_rate)
    dep = apgb.money(repl * dep_pct / 100)
    net = repl - dep
    parts = {}
    for part, keys in HOUSE_EXTRAS.items():
        tot = sum(num(rep.get(k)) for k in keys)
        for k in keys:
            f[k] = f'Rs {inr(num(rep.get(k)))}/-' if num(rep.get(k)) else '--'
        parts[part] = tot
        f[part] = f'Rs {inr(tot) if tot else "0.00"}/-'
    total = land + net + sum(parts.values())
    bank_apt = {**BANK, 'realizable': 0.95, 'distress': 0.90}
    fmv, _, _ = bob.final_values(f, case, rep, 'apartment', total, step=10000, bank=bank_apt)
    uds_yd, parent_yd = trunc2(uds_c * SQYD_PER_CENT), trunc2(parent_c * SQYD_PER_CENT)
    loc = (f'Flat No: {flat} ({ordinal} Floor), Site Survey No’s: {survey}, Door No :  {door}, Ward No : {ward}, {landmark}, '
           f'{village} Village Filed At {lb} of {dotted(district)} (Dist).')
    f.update({
        'deedDate': apgb.ddmmyyyy(pd.get('deedDate')) or pd.get('deedYear') or '---',
        'aptName': apt, 'flatNo': flat, 'floorOrdinalLine': f'{ordinal} Floor', 'wardNo': ward,
        'floorsDesc': rep.get('floorsDesc') or '---', 'udsCents': cents_txt(uds_c), 'udsSqyd': f'{uds_yd:.2f}',
        'parentSqyd': f'{parent_yd:.2f}', 'aptTitle': f'Residential Flat in “{apt}” At {loc}',
        'purposeFull': 'To Ascertain Present Market Value of the Property.',
        'aptLocation': f'Residential Flat in {apt} (Residential Apartment), {loc}',
        'buildingDesc': rep.get('buildingDesc') or 'The Building consist of Residential Flat – R.C.C Framed Structure & R.C.C Roof with brick masonry.',
        'flatDoorLine': f'“ {apt}”, Flat No:- {flat} ({ordinal} Floor), Door No:- {door},',
        'villageLine': f'{landmark}, {village} Village Filed,', 'localBodyLine2': f'{lb} Of {dotted(district)} (Dt).',
        'postalLine': f'“ {apt}”, Flat No:{flat} ({ordinal} Floor), Door No:- {door}, Ward No:- {ward}, {landmark}, {village} Village Filed, {lb} Of {dotted(district)} (Dt).',
        'localBodyType': 'Corporation Limit', 'parentLine': f'{parent_yd:.2f} Sqyd (or) {cents_txt(parent_c)} Cents' if parent_c else '---',
        'udsOutOf': f'{uds_yd:.2f} Sqyds out Of  {parent_yd:.2f} Sqyds', 'udsLine': f'{uds_yd:.2f} Sqyd (or) {cents_txt(uds_c)} Cents',
        'udsCentsLine': f'{cents_txt(uds_c)} Cents', 'rentLine': '--',
        'marketRateLine': f'Rs {inr(rate)}/- Cent', 'landCalc': f'{cents_txt(uds_c)} Cents X Rs {inr(rate)}/- per Cent',
        'landCalc2': f'= Rs {inr(land)}/-',
        'yearAgeLine': f'     {rep.get("yearOfConstruction") or apgb.dt.date.today().year - age} ( {age} Years)',
        'floorLineComma': f'{floor} Floor,', 'plinthLine': f'{plinth:.2f} Sqft',
        'buildingTotalLine': f'Rs  {inr(net)}/-',
        'absA': f'Rs   {inr(land)}/-', 'absB': f'Rs  {inr(net)}/-',
        **{k: f'Rs  {inr(parts[p]) if parts[p] else "0.00"}/-'
           for k, p in (('absC', 'partC'), ('absD', 'partD'), ('absE', 'partE'), ('absF', 'partF'))},
        'absTotal': f'Rs {inr(total)}/-', 'absSayAs': f'Rs {inr(fmv)}/-',
        'declBackground': f'{cents_txt(uds_c)} Cents of freehold land belonging to the client. The Residential Flat in “{apt}” At {loc}',
        'declPurposeLine': f'Central Bank Of India, {f["bankBranchUpper"]},  {dotted(district)}. (DT). ',
    })
    for side in ('North', 'South', 'East', 'West'):
        f[f'dimDeed{side}'] = rep.get(f'dimDeed{side}') or '---'
        f[f'fb{side}'] = rep.get(f'fb{side}') or '---'
    rows = [{'snoDot': '1.', 'label': f'Flat No:- {flat}', 'plinth': f'{plinth:.2f} Sqft', 'height': rep.get('floorHeight') or '10’0”',
             'age': f'{age} Y', 'rateSqft': f'Rs {int(c_rate)}/ Sqft', 'replacement': f'Rs {inr(repl)}/-',
             'depPct': f'({dep_pct:g}%)', 'depAmount': f'Rs {inr(dep)}/-', 'net': f'Rs  {inr(net)}/-'}]
    common(f, case, rep)
    images = apgb.geo_and_photos(case, rep, f, temps, 8)
    apply_overrides(f, rep)
    return {'fields': f, 'rows': {'fl': rows}, 'images': images}


# ---------------------------------------------------------------- OPEN SITE
def build_open_site(case, temps, bank=None):
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    defaults = {**HOUSE_DEFAULTS, 'purpose': 'Bank Purpose', 'occupancy': 'Vacant', 'cityTown': 'Kadapa Municipal Corporation',
                'areaResidential': 'Residential', 'areaClass': 'High', 'localBodyType': 'Municipal Corporation Limit',
                'cornerPlot': 'Intermittent Plot', 'doorLine': '----'}
    f = apgb.common_fields(case, rep, defaults)
    bob.owners(f, case, rep)
    owner_fields(f, case, rep)
    applicant(f, rep)
    district = f['district']
    lb = rep.get('localBodyName') or 'Kadapa Municipal Corporation'
    village, ward, landmark = rep.get('village') or '---', rep.get('wardNo') or pd.get('wardNo') or '---', rep.get('landmark') or '---'
    near = rep.get('nearBy')
    survey, plot = f['surveyNo'] or '---', f['plotNo'] or '---'
    for side in ('North', 'South', 'East', 'West'):
        f[f'dimDeed{side}'] = rep.get(f'dimDeed{side}') or '---'
        f[f'dimActual{side}'] = rep.get(f'dimActual{side}') or f[f'dimDeed{side}']
    deed_c = apgb.extent_in_cents(rep.get('extentDeedRaw') or pd.get('netExtent'))
    plan_c = apgb.extent_in_cents(rep.get('netExtentPlanRaw')) or deed_c
    considered = min(x for x in (deed_c, plan_c) if x) if (deed_c or plan_c) else 0
    rate = num(rep.get('marketRatePerCent')) or num(pd.get('landRate')) * SQYD_PER_CENT
    guide = num(rep.get('guidelineRatePerSqyd')) or num(pd.get('guidelineRate'))
    land = apgb.money(considered * rate)
    fmv, _, _ = bob.final_values(f, case, rep, 'openSite', land, step=BANK['site_say_step'], bank=BANK)

    def ext(c):
        return f'{trunc2(c * SQM_PER_CENT):.2f} Sqmts (or) {trunc2(c * SQYD_PER_CENT):.2f} Sqyds (or) {cents_txt(c)} Cents'
    tail = (f'Ward No : {ward}, In {landmark},' + (f' Near {near},' if near else '')
            + f' {village} Village Field At {lb} of  {dotted(district)}. Dist.')
    loc = f'In Survey No : {survey}, Plot No: {plot}, {tail}'
    f.update({
        'deedDate': apgb.ddmmyyyy(pd.get('deedDate')) or pd.get('deedYear') or '---', 'plotNo': plot, 'localBodyName': lb,
        'owner1RelPlain': f['owner1RelLine'].strip() if f['owner1RelLine'] != DROP else DROP,
        'applicantLabel': 'Applicant :-' if rep.get('applicantName') else DROP,
        'applicantLabel2': 'Applicant : -' if rep.get('applicantName') else DROP,
        'applicantRelPlain': f['applicantRel'],
        'siteTitle': f'{rep.get("siteType") or "Residential Vacant Site"} {loc}',
        'villageLine': f'{village} Village Filed,', 'wardLine': f'Ward No : {ward}, In {landmark},' + (f' Near {near},' if near else ''),
        'postalLine': loc, 'extentDeedLine': ext(deed_c), 'extentPlanLine': ext(plan_c), 'extentConsideredLine': f' {ext(considered)}',
        'rentLine': '--', 'marketRateLine': f'Rs {inr(rate)}/- cent',
        'guidelineRateLine': f'Rs {inr(guide)}/- Per Sqyd' if guide else '---',
        'landCalc': f'{cents_txt(considered)} Cents X Rs {inr(rate)}/- per Cent', 'landCalc2': f'= Rs {inr(land)}/-',
        'absA': f'Rs  {inr(land)}/-', 'absTotal': f'Rs  {inr(land)}/-', 'absSayAs': f'Rs  {inr(fmv)}/-',
        'declBackground': f'{cents_txt(considered)} Cents of freehold land belonging to the client. The land bearing At {loc}',
    })
    common(f, case, rep)
    f['fmvWordsCoreUpper'] = f['fmvWordsCoreUpper'].replace('THOUSAND', 'THOUSANDS')
    f['declPurpose'] = f'For collateral security. Manager, CENTRAL BANK OF INDIA, {f["bankBranchUpper"]}, {dotted(district)}. (DT).'
    images = apgb.geo_and_photos(case, rep, f, temps, 6)
    apply_overrides(f, rep)
    return {'fields': f, 'rows': {}, 'images': images}


BUILDERS = {'house': build_house, 'apartment': build_apartment, 'open_site': build_open_site}
TEMPLATES = {name: f'cbi_{name}.docx' for name in BUILDERS}
format_for = apgb.format_for


def build(case, out_path):
    fmt = format_for(case)
    if fmt not in BUILDERS:
        raise NotImplementedError(f'Central Bank of India {fmt} format not built yet')
    temps = []
    job = BUILDERS[fmt](case, temps)
    job['template'] = os.path.join(HERE, 'templates', TEMPLATES[fmt])
    job['out'] = out_path
    return job, temps

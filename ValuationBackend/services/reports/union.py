"""
Union Bank of India report builder (the bank's own formats in union_source/).

Union Bank's rules, read from the bank's sample reports:
  • "Say" = the total rounded down to ₹10,000 (60,02,000 → 60,00,000; 4,06,16,640 → 4,06,10,000),
    unless the engineer types the Say amount (report field sayValue)
  • Realizable / distress = 90% / 80% of the Say (the % come from Settings → Banks), rounded to the
    nearest ₹10,000 (29,40,000 → 26,50,000 / 23,50,000; 4,06,10,000 → 3,65,50,000 / 3,24,90,000);
    open sites to the nearest ₹1,000 (18,40,000 → 16,56,000 / 14,72,000)
  • Building depreciation 1% per year of age
The house layout is the same valuer's layout as Bank of Baroda, so the BoB builder does the sums and
this module re-words the lines the way Union Bank's file prints them.
"""
import os
import re

import apgb
import bob
from apgb import inr, num, words, trunc2, SQYD_PER_CENT, SQM_PER_CENT, SQFT_PER_SQM, apply_overrides

HERE = os.path.dirname(os.path.abspath(__file__))
DROP = bob.DROP




def cents_txt(c):
    """2.938 / 2.58 — three decimals when the third one is used."""
    s = f'{c:.3f}'
    return s[:-1] if s.endswith('0') else s


def extent(cents, with_yards=True):
    return (f'{trunc2(cents * SQM_PER_CENT):.2f} Sqmts  (or) {trunc2(cents * SQYD_PER_CENT):.2f} Sqyds (or) '
            f'{cents_txt(cents)} Cents')


HOUSE_EXTRAS = {
    'partC': ['ex_portico', 'ex_frontDoor', 'ex_sitOut', 'ex_ohTank', 'ex_gates'],
    'partD': ['am_wardrobes', 'am_glazedTiles', 'am_sinks', 'am_marble', 'am_interior', 'am_elevation',
              'am_paneling', 'am_aluminium', 'am_handRails', 'am_falseCeiling'],
    'partE': ['mi_toilet', 'mi_lumber', 'mi_sump', 'mi_trees'],
    'partF': ['sv_water', 'sv_drainage', 'sv_compoundWall', 'sv_cbDeposits', 'sv_pavement'],
}
HOUSE_DEFAULTS = {
    'purpose': 'For Bank Purpose', 'mvCertificate': 'Copy enclosed', 'tenure': 'Free Hold', 'cityTown': 'Kadapa City',
    'areaResidential': 'Yes', 'areaCommercial': '--', 'areaIndustrial': '--', 'areaClass': 'High', 'areaUrban': 'Urban',
    'localBodyType': 'Corporation Limits', 'govtEnactments': 'No', 'agriConversion': 'NA', 'occupancy': 'Occupied by Owner',
    'locality': 'High', 'surroundings': 'Residential', 'flooding': 'Nil', 'civicAmenities': 'At Walkable Distance',
    'levelOfLand': 'Level of Ground', 'landShape': 'Rectangular', 'landUse': 'Residential', 'usageRestriction': 'Nil',
    'layoutApproved': 'Not Approved', 'cornerPlot': 'Intermittent Plot', 'roadFacilities': 'Provided',
    'roadType': 'Metal Road', 'roadWidth': 'Above 20’0” Wide Road', 'landLocked': 'No',
    'water': 'Adequate Corporation Tap', 'sewerage': 'No', 'power': 'Provided', 'advantage1': 'High demand locality',
    'specialRemarks': 'Nil', 'buildingType': 'Residential', 'constructionType': 'Framed Structure',
    'conditionExterior': 'Good', 'conditionInterior': 'Good', 'planAuthority': 'Commissioner ,',
    'planVerified': 'YES', 'planComments': 'Plan Approval is genuine',
    'specGF_foundation': 'R.C.C Isolated Footing', 'specGF_basement': 'R.R. Stone Masonry',
    'specGF_superstructure': 'Brick Masonry in C.M(1:5)', 'specGF_joinery': 'Country Wood',
    'specGF_rccWorks': 'R.C.C Roof', 'specGF_plastering': 'Cement Plastering', 'specGF_flooring': 'Granite',
    'specGF_specialFinish': 'Yes', 'specGF_roofing': 'R.C.C. Roof', 'specGF_drainage': 'Provided',
    'compoundWall': 'Yes', 'cwHeight': ' ', 'cwLength': '---', 'cwType': '---', 'wiring': 'CTS & CONCELED',
    'fittingsClass': 'ORDINARY', 'lightPoints': 'ADEQUATE', 'plugPoints': 'PROVIDED', 'electricalOther': 'MAIN SWITCHES',
    'waterClosets': 'Two', 'washBasins': 'Two', 'urinals': '---', 'bathTubs': '---',
    'waterMeter': 'Tap Connection Provided', 'otherFixtures': '---', 'district': 'Y S R',
}
BANK = {'label': 'Union Bank of India', 'realizable': 0.90, 'distress': 0.80, 'say_step': 10000,
        'site_say_step': 10000, 'value_round': 10000, 'pct_of': 'say', 'extent': extent,
        'extras': HOUSE_EXTRAS, 'defaults': {'house': HOUSE_DEFAULTS, 'apartment': {'district': 'Y S R'}}}


def core_words(n):
    """'Rupees Sixty Lakhs Only' → 'Sixty Lakhs'."""
    return re.sub(r'^Rupees\s+|\s+Only$', '', words(n))


def dotted(district):
    """'Y S R' → 'Y.S.R' (the bank's file writes it both ways)."""
    return re.sub(r'\b(\w) (?=\w\b)', r'\1.', district)


def item(v):
    return inr(v) if v else '---'


def part_total(v):
    return f'Rs {inr(v)}/-' if v else 'Rs 0.00/-'


def owner_block(f, case, rep):
    """Union prints one 'Belongs to' block: all owners' names, the first owner's relation and address."""
    names = [f['owner1Name']] + [f[k] for k in ('owner2Name', 'owner3Name') if f.get(k) and f[k] != DROP]
    f['owner1Name'] = ' & '.join(n for n in names if n and n != '---') or '---'
    if f.get('owner1Rel') == DROP:
        f['owner1Rel'] = ' '
    elif not f['owner1Rel'].endswith('.'):
        f['owner1Rel'] += '.'
    if f.get('owner1Addr') == DROP:
        f['owner1Addr'] = ' '
    f['ownerPhone'] = rep.get('ownerPhone') or case.get('clientPhone') or case.get('phone') or '---'


def gps_split(f):
    dms = f.get('gpsDms') or '---'
    lat, _, lng = dms.partition(' ')
    f['latDms'], f['lngDms'] = lat or '---', lng or '---'


def build_house(case, temps, bank=None):
    job = bob.build_house(case, temps, bank=BANK)
    f = job['fields']
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    owner_block(f, case, rep)
    gps_split(f)

    survey, door, ward = f['surveyNo'] or '---', f['doorNo'] or '---', f['wardNo']
    landmark, village, lb, district = f['landmark'], f['village'], f['localBodyName'], f['district']
    near = rep.get('nearBy') or ''
    plot = f.get('plotNo') or '---'
    f.update({
        'plotNo': plot, 'nearByPart': f', {near}' if near else '',
        'localBodyLine': f'{lb} Of {dotted(district)} (Dt).', 'districtDotted': dotted(district),
        'postalLine': f'Door No : {door}, Ward No : {ward}, In {landmark}, {village} Village Field  At  {lb}  of  {district} (Dt).',
        'planValidity': rep.get('planValidity') or '---',
        'planAuthority2': rep.get('planAuthority2') or f'{lb}.',
    })

    # Land lines in Union's wording
    deed_c = apgb.extent_in_cents(rep.get('extentDeedRaw') or pd.get('netExtent'))
    plan_c = apgb.extent_in_cents(rep.get('netExtentPlanRaw')) or deed_c
    considered = min(x for x in (deed_c, plan_c) if x) if (deed_c or plan_c) else 0
    rate_cent = num(rep.get('marketRatePerCent')) or num(pd.get('landRate')) * SQYD_PER_CENT
    guide = num(rep.get('guidelineRatePerSqyd')) or num(pd.get('guidelineRate'))
    land = apgb.money(considered * rate_cent)
    f.update({
        'netExtentPlan': extent(plan_c), 'extentConsidered': extent(considered),
        'netExtentCents': cents_txt(considered),
        'marketRateLine': f'Rs {inr(rate_cent)}/-Cent', 'guidelineRateLine': f'Rs {int(guide)}/- Sqyd' if guide else '---',
        'adoptedRateLine': f'{cents_txt(considered)} Cents X Rs  {inr(rate_cent)}/-Cent', 'landValueLine': f'Rs {inr(land)}/-',
    })

    # Floors: codes in their own column, the areas beside them
    codes, plinth, carpet = [], [], []
    for row in job['rows']['fl']:
        area = num(row['plinth'])
        label = row['label']
        code = next((v for k, v in bob.FLOOR_CODES.items() if k in label.lower()), label)
        codes.append(code)
        plinth.append(f'{trunc2(area / SQFT_PER_SQM):.2f} Sqmts (or) {area:.2f} Sqft')
        carpet.append(f'{trunc2(area * 0.85):.2f} Sqft')
        row.update({'label': label.title(), 'age': row['age'].replace(' Y', ' y'), 'rate': f"{row['rate']} Sqft",
                    'depPct': row['depPct'].replace('(-', 'RS (').replace('%)', ' %)'),
                    'depAmount': row['depAmount'].replace('Rs. ', '').replace('000/-', '0/-') if row['depAmount'].endswith(' 000/-') else row['depAmount'].replace('Rs. ', '')})
    f.update({
        'floorCodes': '\n'.join(codes) or 'GF',
        'plinthPlan': rep.get('plinthPlanLine') or '\n'.join(plinth) or '---',
        'plinthActual': rep.get('plinthActualLine') or '\n'.join(plinth) or '---',
        'carpetPlan': rep.get('carpetArea') or '\n'.join(carpet) or '---',
        'carpetActual': rep.get('carpetArea') or '\n'.join(carpet) or '---',
        'remainingLifeLine': f.get('remainingLifeLine', '').replace('Years', 'Y'),
    })

    # Parts C–F: items show '---' when empty
    parts = {}
    for part, keys in HOUSE_EXTRAS.items():
        tot = 0
        for k in keys:
            v = num(rep.get(k))
            tot += v
            f[k] = item(v)
        parts[part] = tot
        f[part] = part_total(tot)
    building = num(re.sub(r'[^\d.]', '', f['buildingTotalLine']))
    total = land + building + sum(parts.values())
    say = num(re.sub(r'[^\d.]', '', f['fmv']))
    f.update({
        'absA': f'Rs. {inr(land)}/-', 'absB': f'Rs. {inr(building)}/-',
        **{k: f'Rs.  {inr(parts[p]) if parts[p] else "0.00"}/-'
           for k, p in (('absC', 'partC'), ('absD', 'partD'), ('absE', 'partE'), ('absF', 'partF'))},
        'absTotal': f'Rs.  {inr(total)}/-', 'absSayAs': f'Rs   {inr(say)}/-',
        'fmvWordsCore': core_words(say), 'fmvWordsCoreUpper': core_words(say).upper(),
        'declBackground': (f'{cents_txt(considered)}  Cents of freehold land belonging to the client. The land bearing '
                           f'Site Survey No : {survey}, Plot No : {plot}, Door No : {door}, Ward No : {ward}, In '
                           f'{landmark}{f["nearByPart"]}, {village} Village Field  At  {lb}  of  {district} (Dt).'),
        'declPurpose': f'For collateral security.  The Manager, Union Bank of India, {(case.get("bankBranch") or "").strip()}, ',
        'declPurpose2': f'{dotted(district)} (Dt).',
    })
    apply_overrides(f, rep)
    return job


def owner_lines(f, case, rep, n=5):
    """'1) Sri. S. Mallikarjuna Rao, S/o. Sri. S. Ramaiah (Late).' — one line per owner, unused lines dropped."""
    people = [(f['owner1Name'], f.get('owner1Rel'))]
    for i in range(2, n + 1):
        if rep.get(f'owner{i}Name'):
            people.append((apgb.title_for(rep[f'owner{i}Name'], rep.get(f'owner{i}Rel')), bob.relation(rep.get(f'owner{i}Rel'))))
    for i in range(1, n + 1):
        if i <= len(people):
            name, rel = people[i - 1]
            rel = rel if rel and rel != DROP else ''
            f[f'ownerLine{i}'] = f'{i}) {name}' + (f', {rel.rstrip(".")}.' if rel else '.')
        else:
            f[f'ownerLine{i}'] = DROP
    apps = []
    for i in ('', '2'):
        name = rep.get(f'applicant{i}Name') or (rep.get('applicant1Name') if i == '' else '')
        if name:
            apps.append((name.rstrip(', ') + ',  ', bob.relation(rep.get(f'applicant{i}Rel') or rep.get('applicant1Rel' if i == '' else '')) or ' '))
    f['applicantLabel'] = 'Applicant’s:- ' if apps else DROP
    for k in (1, 2):
        name, rel = apps[k - 1] if k <= len(apps) else (DROP, DROP)
        f[f'applicant{k}Name'] = name
        f[f'applicant{k}Rel'] = ('        ' + rel.rstrip('.') + '.') if rel not in (DROP, ' ') else rel
    f['applicantAddr'] = rep.get('applicantAddr') or (' ' if apps else DROP)


def build_apartment(case, temps, bank=None):
    job = bob.build_apartment(case, temps, bank=BANK)
    f = job['fields']
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    owner_lines(f, case, rep)
    uds = apgb.extent_in_cents(rep.get('udsDeedRaw') or pd.get('netExtent'))
    parent = apgb.extent_in_cents(rep.get('parentExtentDeedRaw'))
    survey, door = f['surveyNo'] or '---', f['doorNo'] or '---'
    ward = rep.get('wardNo') or pd.get('wardNo') or '---'
    lb, district = f['localBodyName'] if f.get('localBodyName') else 'Kadapa Municipal Corporation', f['district']
    near = rep.get('nearBy')
    status = rep.get('flatStatus') or ''
    road = rep.get('roadNo')
    apt = f['aptName']
    say = num(re.sub(r'[^\d.]', '', f['fmv']))
    surveys = re.sub(r',\s*(?=[^,]*$)', ' & ', survey)
    loc = (f'Flat No : {f["flatNo"]} ({f["floorName"]} Floor), In Survey No’s : {surveys}, Door No : {door}, '
           f'Ward No : {ward}, In {f["landmark"]},' + (f' Road No : {road},' if road else '') +
           (f' Near {near},' if near else '') + f' {f["village"]} Village Field At {lb} of  {dotted(district)} (Dt).')
    f.update({
        'aptNameUpper': apt.upper(), 'builderName': rep.get('builderName') or ' ',
        'floorsDesc': rep.get('floorsDesc') or f.get('floorsDesc') or '---',
        'udsCents': cents_txt(uds) if uds else '---', 'parentCents': cents_txt(parent) if parent else '---',
        'deed2No': rep.get('deed2No') or DROP,
        'aptTitle': f'Residential Flat In “{apt}”,                Residential Apartment' + (f' ({status})' if status else '') + ', ' + loc,
        'fmvWordsCore': core_words(say), 'fmvWordsCoreUpper': core_words(say).upper(),
        'localBodyLine': f'{lb}, {dotted(district)} Dist.',
        'declBackground': (f'{cents_txt(uds)} Cents of freehold land belonging to the client. The land bearing At Residential '
                           f'Flat In “{apt}” Residential  Apartments ' + (f'({status}), ' if status else '') + loc),
        'declBuilding': f'Residential Flat on the said land. Built up area : {num(re.sub(r"[^\d.]", "", f["plinthLine"])):.2f} Sqft ',
        'declPurpose': f'For collateral security. Manager, UNION BANK OF INDIA, {f["bankBranchUpper"]}, {dotted(district)}. (DT).',
        'declDates1': f'Date of appointment: {f["inspectionDate"]}, ',
        'declDates2': f'Valuation date: {f["reportDate"]} ', 'declDates3': f'Date of report: {f["reportDate"]}.',
    })
    apply_overrides(f, rep)
    return job


# ---------------------------------------------------------------- OPEN SITE
SITE_DEFAULTS = {
    'purpose': 'For Bank Purpose', 'mvCertificate': 'Copy Enclosed', 'cityTown': None, 'areaResidential': 'Yes',
    'areaCommercial': 'NA', 'areaIndustrial': 'NA', 'areaClass': 'Middle', 'areaUrban': 'Urban', 'govtEnactments': '--',
    'agriConversion': 'No', 'occupancy': 'Vacant Land (Owner)', 'locality': 'Middle', 'surroundings': 'Residential',
    'flooding': 'No', 'civicAmenities': 'At  Walkable Distance', 'levelOfLand': 'Level of Ground',
    'landShape': 'Rectangular', 'landUse': 'Residential', 'usageRestriction': 'Nil', 'layoutApproved': 'NA',
    'cornerPlot': 'Intermittent  Plot', 'roadFacilities': 'Provided', 'roadType': 'CC Road', 'roadWidth': '20’0” Wide Road',
    'landLocked': 'No', 'water': 'Available', 'sewerage': 'Open Area', 'power': 'Provided', 'specialRemarks': 'Nil',
    'district': 'Y S R', 'place': 'Kadapa', 'siteType': 'Residential Vacant Site',
}


def sqyd_cents(c):
    return f'{trunc2(c * SQYD_PER_CENT):.2f} Sqyds (or) {cents_txt(c)} Cents'


def sqm_cents(c):
    return f'{trunc2(c * SQM_PER_CENT):.2f} Sqmts (or) {cents_txt(c)} Cents'


def site_location(f, rep):
    """'At In Site Survey No : 189/5, Door No : 2/311-1, Ward No : 02, In Maruti Nagar, Nagarajupeta, Kadapa Town
    At Kadapa Municipal Corporation Of Y.S.R. (Dt).'"""
    town = rep.get('town') or 'Kadapa Town'
    return (f'Site Survey No : {f["surveyNo"] or "---"}, Door No : {f["doorNo"] or "---"}, Ward No : {f["wardNo"]}, '
            f'In {f["landmark"]}, {f["village"]}, {town} At {f["localBodyName"]} Of {dotted(f["district"])}. (Dt).')


def build_open_site(case, temps, bank=None):
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    f = apgb.common_fields(case, rep, dict(SITE_DEFAULTS))
    bob.owners(f, case, rep)
    owner_block(f, case, rep)
    lb = rep.get('localBodyName') or 'Kadapa Municipal Corporation'
    district = f['district']
    f.update({
        'village': rep.get('village') or '---', 'wardNo': rep.get('wardNo') or pd.get('wardNo') or '---',
        'landmark': rep.get('landmark') or '---', 'localBodyName': lb, 'districtDotted': dotted(district),
        'plotNo': f['plotNo'] or '---', 'planNo': f['planNo'] or 'NA', 'planDate': f['planDate'] or '---',
        'deedDate': apgb.ddmmyyyy(pd.get('deedDate')) or pd.get('deedYear') or '---',
        'cityTown': rep.get('cityTown') or f'{lb}, {dotted(district)}.(Dt).',
        'localBodyType': rep.get('localBodyType') or f'{lb} Of {dotted(district)}.(Dt).',
        'localBodyLine': f'{lb}, {dotted(district)} (Dt).',
    })
    pin = rep.get('pinCode')
    loc = site_location(f, rep)
    f.update({
        'siteTitle': f'{f["siteType"]}, At In {loc}' + (f' Pin Code : {pin}.' if pin else ''),
        'briefDesc': f'Located At In {loc}' + (f' Pin Code : {pin}.' if pin else ''),
        'postalLine': f'In {loc}' + (f' Pin Code : {pin}.' if pin else ''),
        'pinLine': f' Pin Code : {pin}.' if pin else ' ',
        'advantage1': rep.get('advantage1') or f'It is In {f["landmark"]} Road',
    })
    for side in ('North', 'South', 'East', 'West'):
        f[f'dimDeed{side}'] = rep.get(f'dimDeed{side}') or '---'
        f[f'dimActual{side}'] = rep.get(f'dimActual{side}') or f[f'dimDeed{side}']

    deed_c = apgb.extent_in_cents(rep.get('extentDeedRaw') or pd.get('netExtent'))
    plan_c = apgb.extent_in_cents(rep.get('netExtentPlanRaw')) or deed_c
    considered = min(x for x in (deed_c, plan_c) if x) if (deed_c or plan_c) else 0
    rate_cent = num(rep.get('marketRatePerCent')) or num(pd.get('landRate')) * SQYD_PER_CENT
    guide = num(rep.get('guidelineRatePerSqyd')) or num(pd.get('guidelineRate'))
    land = apgb.money(considered * rate_cent)
    deed_line = sqyd_cents(deed_c)
    f.update({
        'extentDeed': deed_line, 'extentActual': deed_line, 'sizeNorthSouth': deed_line, 'sizeEastWest': deed_line,
        'totalExtent': deed_line, 'netExtentPlan': sqm_cents(plan_c), 'extentConsidered': sqm_cents(considered),
        'netExtentCents': cents_txt(considered),
        'marketRateLine': f'Rs {inr(rate_cent)}/- Cent', 'guidelineRateLine': f'Rs {inr(guide)}/- Sqyd' if guide else '---',
        'adoptedRateLine': f'Rs {inr(rate_cent)}/- Cent  X  {cents_txt(considered)} Cent',
        'landValueLine': f'Rs {inr(land)}/-',
    })
    total = land
    fmv, _, _ = bob.final_values(f, case, rep, 'openSite', total, step=BANK['site_say_step'],
                                 bank={**BANK, 'value_round': 1000})
    f.update({
        'absA': f'Rs. {inr(land)}/-', 'absTotal': f'Rs. {inr(total)}/-', 'absSayAs': f'Rs. {inr(fmv)}/-',
        'fmvWordsCore': core_words(fmv), 'fmvWordsCoreUpper': core_words(fmv).upper(),
        'declBackground': f'{cents_txt(considered)} Cents of freehold land belonging to the client. The land bearing Site At {loc}',
        'declPurpose': f'For collateral security.  The Manager, Union Bank Of India, {(case.get("bankBranch") or "---").strip()}, {dotted(district)}. (Dt).',
    })
    images = apgb.geo_and_photos(case, rep, f, temps, 4)
    apply_overrides(f, rep)
    return {'fields': f, 'rows': {}, 'images': images}


# ---------------------------------------------------------------- AGRICULTURE
AGRI_DEFAULTS = {
    'purpose': 'For Bank Purpose', 'mvCertificate': '--', 'tenure': 'Free Hold', 'postalAddress': 'As the above',
    'areaResidential': '--', 'areaCommercial': '--', 'areaIndustrial': '--', 'areaAgriculture': 'Yes',
    'areaClass': 'Middle', 'areaUrban': 'Rural', 'localBodyType': 'Panchayat Limit', 'govtEnactments': 'No',
    'agriConversion': 'NA', 'occupancy': 'Occupied by Owners', 'locality': 'Middle', 'surroundings': 'Agriculture',
    'flooding': 'Nil', 'civicAmenities': 'At Walkable Distance', 'levelOfLand': 'Level of Ground',
    'landShape': 'Rectangular', 'landUse': 'Agriculture', 'usageRestriction': 'Nil', 'layoutApproved': 'Not Approved',
    'cornerPlot': 'Intermittent Plot', 'roadFacilities': 'Provided', 'roadType': 'Metal Road',
    'roadWidth': '15 ft Wide Road', 'landLocked': 'No', 'water': 'Available', 'sewerage': '--', 'power': 'Provided',
    'advantage1': ' ', 'specialRemarks': 'Nil', 'doorNo': '--', 'district': 'Y S R', 'place': 'Kadapa',
}


def build_agriculture(case, temps, bank=None):
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    f = apgb.common_fields(case, rep, dict(AGRI_DEFAULTS))
    bob.owners(f, case, rep)
    owner_block(f, case, rep)
    district = f['district']
    village = rep.get('village') or '---'
    panchayat = rep.get('panchayat') or f'{village} Panchayat'
    mandal = rep.get('mandal') or '---'
    items = [i for i in (rep.get('items') or []) if i and (i.get('survey') or i.get('extent'))]
    if not items:
        items = [{'survey': pd.get('surveyNo'), 'extent': rep.get('extentDeedRaw') or pd.get('netExtent')}]
    acres = [apgb.acres_of(i.get('extent')) if not re.fullmatch(r'\s*[\d.]+\s*', str(i.get('extent') or ''))
             else num(i.get('extent')) for i in items]
    total_ac = sum(acres)
    lines = [f'Survey No : {i.get("survey") or "---"},            Extent : Ac {a:.2f} Cents,' for i, a in zip(items, acres)]
    if rep.get('agSource'):              # e.g. 'As Per- 1B' — printed after the last survey line
        lines[-1] += '\t' + rep['agSource']
    rate = num(rep.get('ratePerAcre')) or num(pd.get('landRate'))
    land = apgb.money(total_ac * rate)
    ext = f'Ac {total_ac:.2f} Cents'
    plan_ac = apgb.acres_of(rep.get('netExtentPlanRaw')) or total_ac
    surveys = ', '.join(str(i.get('survey') or '') for i in items if i.get('survey')) or (f['surveyNo'] or '---')
    loc = f'{village}, {panchayat}, {mandal} Mandal of {district} (DT).'
    f.update({
        'khataNo': rep.get('khataNo') or rep.get('khathaNo') or '--',
        'khataLine': f'Khata No : {rep.get("khataNo") or rep.get("khathaNo") or "--"}, ',
        'agLines': '\n'.join(lines), 'agSourceLine': DROP, 'doorNo': f['doorNo'] or '--',
        'totalAcres': f'{total_ac:.2f}', 'agTitle': f'Agriculture Land, In {loc}',
        'surveyLine': f'Survey No :  {surveys}', 'villageLine': f'{village},', 'panchayatLine': f'{panchayat},',
        'mandalLine': f'{mandal} Mandal Of  {dotted(district)} (Dt)', 'cityTown': f'{mandal} Mandal,',
        'mandalLineUpper': f'{mandal.upper()} MANDAL, {dotted(district)} (DT).',
        'planLine': f['planLine'] if f.get('planNo') else '--',
        'extentDeed': ext, 'extentActual': ext, 'extentPlan': f'Ac {plan_ac:.2f} Cents',
        'extentConsidered': f'Ac {min(total_ac, plan_ac):.2f} Cents',
        'marketRateLine': f'Rs {inr(rate)}/- Acre',
        'guidelineRateLine': f'Rs {inr(num(rep.get("guidelineRatePerAcre")))}/- Acre' if rep.get('guidelineRatePerAcre') else '--',
        'adoptedRateLine': f'{ext} X  Rs {inr(rate)}/- Acre', 'landValueLine': f'Rs  {inr(land)}/-',
    })
    total = land
    fmv, _, _ = bob.final_values(f, case, rep, 'agriculture', total, step=BANK['site_say_step'], bank=BANK)
    f.update({
        'absA': f'Rs.  {inr(land)}/-', 'absTotal': f'Rs.  {inr(total)}/-', 'absSayAs': f'Rs.  {inr(fmv)}/-',
        'fmvWordsCore': core_words(fmv), 'fmvWordsCoreUpper': core_words(fmv).upper(),
        'declBackground': f'{ext} In {loc}',
        'declPurpose': f'For collateral security.  The Manager, Union Bank of India, {(case.get("bankBranch") or "---").strip()}, {dotted(district)} (Dt).',
    })
    images = apgb.geo_and_photos(case, rep, f, temps, 3)
    apply_overrides(f, rep)
    return {'fields': f, 'rows': {}, 'images': images}


# ---------------------------------------------------------------- INDUSTRIAL BUILDING / SHED
SHED_DEFAULTS = {
    'purpose': 'For Bank Purpose', 'mvCertificate': 'Copy Enclosed', 'areaResidential': 'NA', 'areaCommercial': 'NA',
    'areaIndustrial': 'Yes', 'areaClass': 'High', 'areaUrban': 'Urban', 'govtEnactments': '--', 'agriConversion': 'No',
    'occupancy': 'Owners', 'locality': 'High', 'surroundings': 'Industrial Area', 'flooding': 'developing',
    'civicAmenities': 'At  Walkable Distance', 'levelOfLand': 'Level of Ground', 'landShape': 'Rectangular',
    'landUse': 'Industrial Area', 'usageRestriction': 'Nil', 'layoutApproved': 'NA', 'cornerPlot': 'Intermittent Plot',
    'roadFacilities': 'Provided', 'roadType': 'BT Road', 'roadWidth': 'Above 20’0” Wide Road', 'landLocked': 'No',
    'water': 'Available', 'sewerage': 'Open Area', 'power': 'Provided', 'advantage1': 'It is near To Industrial Area',
    'specialRemarks': 'Nil', 'buildingType': 'Industrial', 'constructionType': 'GI Sheet Roof',
    'conditionExterior': 'Normal', 'conditionInterior': 'Normal', 'planVerified': 'Yes', 'planComments': '---',
    'planAuthority': 'Issued By Inspectors Of Industries, Kadapa, Y.S.R. (Dt).', 'plinthNote': 'Least Plinth Area Considered.',
    'specGF_foundation': 'R.C.C Isolated Footing', 'specGF_basement': 'R.R. Stone Masonry',
    'specGF_superstructure': 'Brick Masonry in C.M(1:5)', 'specGF_joinery': 'Wooden Doors & windows & Shutters',
    'specGF_rccWorks': 'G.I.  Roof Sheet', 'specGF_plastering': 'Concrete Flooring', 'specGF_flooring': 'No',
    'specGF_specialFinish': 'No', 'specGF_roofing': 'G.I.  Roof Sheet', 'specGF_drainage': 'Provided',
    'compoundWall': 'Yes', 'cwHeight': '---', 'cwLength': '---', 'cwType': '--', 'wiring': 'CTS & CONCELED',
    'fittingsClass': 'ORDINARY', 'lightPoints': 'ADEQUATE', 'fanPoints': 'PROVIDED', 'plugPoints': 'MAIN SWITCHES',
    'electricalOther': 'Yes', 'waterClosets': '---', 'washBasins': '---', 'urinals': '---', 'bathTubs': '---',
    'waterMeter': 'Tap Connection Provided', 'otherFixtures': '---', 'district': 'Y S R', 'place': 'Kadapa',
}


def build_industrial(case, temps, bank=None):
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    f = apgb.common_fields(case, rep, dict(SHED_DEFAULTS))
    bob.owners(f, case, rep)
    district = f['district']
    lb = rep.get('localBodyName') or 'Kadapa Municipal Corporation'
    village = rep.get('village') or '---'
    area = rep.get('landmark') or rep.get('areaName') or '---'
    plot, shed = f['plotNo'] or '---', rep.get('shedNo') or '---'
    survey = f['surveyNo'] or '---'
    pin = rep.get('pinCode')

    # Owners: up to four "Name, Relation." lines and up to two addresses
    people = [(f['owner1Name'], f['owner1Rel'] if f['owner1Rel'] != DROP else '')]
    for i in range(2, 5):
        if rep.get(f'owner{i}Name'):
            people.append((apgb.title_for(rep[f'owner{i}Name'], rep.get(f'owner{i}Rel')), bob.relation(rep.get(f'owner{i}Rel'))))
    for i in range(1, 5):
        if i <= len(people):
            name, rel = people[i - 1]
            rel = rel.rstrip('.') + '.' if rel else ''
            f[f'ownerLine{i}'] = f'{name}, {rel}'.rstrip(', ') if rel else f'{name}.'
            f[f'owner{i}NameLine'] = f'{name}, '
            f[f'owner{i}RelLine'] = f'           {rel}' if rel else DROP
        else:
            f[f'ownerLine{i}'] = f[f'owner{i}NameLine'] = f[f'owner{i}RelLine'] = DROP
    addr1, addr2 = case.get('address') or '', rep.get('owner2Addr') or ''
    f.update({
        'owner1Addr': addr1 or DROP, 'owner2Addr': addr2 or DROP,
        'owner1AddrLine': (f' 1) {addr1}' if addr2 else f' {addr1}') if addr1 else DROP,
        'owner2AddrLine': f'2) {addr2}' if addr2 else DROP,
    })

    loc = (f'At Site Survey No’s : {survey}, Plot No : {plot}, Shed No : {shed}, In {area}, {village}  Village Field '
           f'At {lb} Of {dotted(district)}. (Dt).')
    plan_no = f['planNo']
    plan_line = f'D. Dis. No : {plan_no}, Dt : {f["planDate"] or "---"}.' if plan_no else 'NA'
    f.update({
        'localBodyName': lb, 'districtDotted': dotted(district), 'plotNo': plot, 'shedNo': shed,
        'deedDate': apgb.ddmmyyyy(pd.get('deedDate')) or pd.get('deedYear') or '---',
        'planLine': plan_line, 'planLineFull': f'Plan Approval No {plan_line}' if plan_no else 'NA',
        'planAuthority': rep.get('planAuthority') or SHED_DEFAULTS['planAuthority'],
        'surveyLine': f'Survey No’s :  {survey}', 'plotShedLine': f'Plot No: {plot}, Shed No : {shed}',
        'villageLine': f'{village} Village Field,', 'areaLine': f'In {area}, ',
        'cityTown': rep.get('cityTown') or f'{lb}, {district.replace(" ", "")} (Dt)',
        'localBodyType': rep.get('localBodyType') or f'{lb}, {district.replace(" ", "")} (Dt)',
        'localBodyLine': f'{lb}, {dotted(district)} (Dt).',
        'briefDesc': f'Located In {loc} ', 'postalLine': f'In {loc} ', 'pinLine': f'Pin Code : {pin}.' if pin else ' ',
    })
    for side in ('North', 'South', 'East', 'West'):
        f[f'dimDeed{side}'] = rep.get(f'dimDeed{side}') or '---'
        f[f'dimActual{side}'] = rep.get(f'dimActual{side}') or f[f'dimDeed{side}']

    # Land, valued per Sqyd
    sqyd = bob.sqyd_of(rep.get('extentDeedRaw') or pd.get('netExtent'))
    plan_yd = bob.sqyd_of(rep.get('netExtentPlanRaw')) or sqyd
    considered = min(x for x in (sqyd, plan_yd) if x) if (sqyd or plan_yd) else 0
    def yd_line(y):
        return f'{y:.2f} Sqyds (or) {trunc2(y * 0.836127):.2f} Sqmts (or) {trunc2(y / SQYD_PER_CENT):.2f} Cents'
    rate = num(rep.get('landRatePerSqyd')) or num(pd.get('landRate'))
    guide = num(rep.get('guidelineRatePerSqyd')) or num(pd.get('guidelineRate'))
    land = apgb.money(considered * rate)
    f.update({
        'netExtentSqyd': f'{considered:.2f}', 'extentDeed': yd_line(sqyd), 'extentActual': yd_line(sqyd),
        'extentPlan': yd_line(plan_yd), 'extentConsidered': yd_line(considered),
        'marketRateLine': f'Rs {inr(rate)}/- Sqyds', 'guidelineRateLine': f'Rs {inr(guide)}/- Sqyds' if guide else '--',
        'adoptedRateLine': f'Rs {inr(rate)}/- Sqyd  X  {considered:.2f} Sqyds', 'landValueLine': f'Rs {inr(land)}/-',
    })

    # Shed / building: one row per floor, 1.5% depreciation per year of age (Union's shed sample)
    age = int(num(pd.get('buildingAge')))
    life = int(num(rep.get('totalLife'), 60)) or 60
    dep_pct = min(age * num(rep.get('depreciationPerYear'), 1.5), 70.0)
    c_rate = num(rep.get('constructionRate')) or 400
    rows, codes, building, actual_total = [], [], 0, 0
    for fl in (pd.get('siteValue') or {}).get('floors') or []:
        area_ft = num(fl.get('value'))
        if not area_ft:
            continue
        label = re.sub(r'\s*\(.*?\)', '', fl.get('label') or 'Floor').strip().title()
        code = next((v for k, v in bob.FLOOR_CODES.items() if k in label.lower()), label)
        fr = num(fl.get('rate')) or c_rate
        repl = apgb.money(area_ft * fr)
        dep = apgb.money(repl * dep_pct / 100)
        building += repl - dep
        actual_total += area_ft
        codes.append(code)
        rows.append({'label': label, 'use': f"({fl.get('use') or rep.get('shedUse') or 'Shed'})",
                     'plinth': f'{area_ft:.2f} Sqft', 'height': rep.get('floorHeight') or '20’', 'ageNum': str(age),
                     'rate': f'Rs {inr(fr)}/- sqft', 'replacement': f'Rs {inr(repl)}/-',
                     'dep': f'(-{dep_pct:g}%) Rs {inr(dep)}/-', 'net': f'Rs {inr(repl - dep)}/-'})
    plan_ft = apgb.sqft_of(rep.get('plinthPlanRaw')) or actual_total
    f.update({
        'yearOfConstruction': rep.get('yearOfConstruction') or str(apgb.dt.date.today().year - age),
        'ageLine': f'{age} Years', 'remainingLifeLine': f'{max(life - age, 0)} Years',
        'floorsLine': rep.get('floorsLine') or ' + '.join(codes) or 'GF',
        'plinthPlan': f'{trunc2(plan_ft / SQFT_PER_SQM):.2f} Sqmts (or) {plan_ft:.2f} Sqft ',
        'plinthActual': f'{trunc2(actual_total / SQFT_PER_SQM):.2f} Sqmts (or) {actual_total:.2f} Sqft ',
        'buildingTotalLine': f'Rs {inr(building)}/-',
    })

    parts = {}
    for part, keys in HOUSE_EXTRAS.items():
        tot = 0
        for k in keys:
            v = num(rep.get(k))
            tot += v
            f[k] = f'Rs {inr(v)}/-' if v else '---'
        parts[part] = tot
        f[part] = f'Rs {inr(tot)}/-' if tot else ('--' if part == 'partC' else '---')
    total = land + building + sum(parts.values())
    fmv, _, _ = bob.final_values(f, case, rep, 'industrial', total, step=BANK['say_step'], bank=BANK)
    f.update({
        'absA': f'Rs. {inr(land)}/-', 'absB': f'Rs. {inr(building)}/-' if building else 'Rs. -----',
        **{k: (f'Rs. {inr(parts[p])}/-' if parts[p] else 'Rs. -----')
           for k, p in (('absC', 'partC'), ('absD', 'partD'), ('absE', 'partE'), ('absF', 'partF'))},
        'absTotal': f'Rs. {inr(total)}/-', 'absSayAs': f'Rs. {inr(fmv)}/-',
        'shedTitle': f'Industrial Building ({" + ".join(codes) or "GF"}) {loc}' + (f' Pin Code : {pin}.' if pin else ''),
        'fmvWordsCore': core_words(fmv), 'fmvWordsCoreUpper': core_words(fmv).upper(),
        'declBackground': (f'{considered:.2f} Sqyds of freehold land belonging to the client. The land bearing '
                           f'{loc[3:]}' + (f' Pin Code : {pin}.' if pin else '')),
        'declPurpose': f'For collateral security.  The Manager, Union Bank of India, {(case.get("bankBranch") or "---").strip()}, {dotted(district)}. (Dt).',
    })
    images = apgb.geo_and_photos(case, rep, f, temps, 7)
    gps_split(f)
    apply_overrides(f, rep)
    return {'fields': f, 'rows': {'fl': rows}, 'images': images}


def format_for(case):
    t = ((case.get('propertyDetails') or {}).get('propertyType') or '').lower()
    if 'industr' in t or 'shed' in t or 'factory' in t:
        return 'industrial'
    return apgb.format_for(case)


BUILDERS = {'house': build_house, 'apartment': build_apartment, 'open_site': build_open_site,
            'agriculture': build_agriculture, 'industrial': build_industrial}
TEMPLATES = {name: f'union_{name}.docx' for name in BUILDERS}


def build(case, out_path):
    fmt = format_for(case)
    if fmt not in BUILDERS:
        raise NotImplementedError(f'Union Bank of India {fmt} format not built yet')
    temps = []
    job = BUILDERS[fmt](case, temps)
    for k, v in job['fields'].items():          # Union's files write "Crore", not "Crores"
        if isinstance(v, str) and 'Words' in k and 'rore' in v.lower():
            job['fields'][k] = v.replace('Crores', 'Crore').replace('CRORES', 'CRORE')
    job['template'] = os.path.join(HERE, 'templates', TEMPLATES[fmt])
    job['out'] = out_path
    return job, temps

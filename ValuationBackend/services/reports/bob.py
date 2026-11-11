"""
Bank of Baroda report builder (the bank's own formats in bob_source/).

Bank of Baroda's rules, read from the bank's sample reports:
  • "Say" (fair market value) = the total rounded down to ₹5,000 (57,38,500 → 57,35,000),
    unless the engineer types the Say amount (report field sayValue)
  • Realizable / distress = 90% / 80% of the TOTAL, rounded to the nearest ₹10,000
    (57,38,500 → 51,60,000 / 45,90,000); the % come from Settings → Banks
  • Building depreciation 1% per year of age
Shared helpers (amounts in words, extents, maps, photos, signature) come from apgb.py.
"""
import datetime as dt
import math
import os
import re

import apgb
from apgb import (inr, words, num, ddmmyyyy, trunc2, extent_in_cents, extent_line, SQYD_PER_CENT, SQFT_PER_SQM,
                  money, common_fields, geo_and_photos, apply_overrides, rates_for, title_for)

HERE = os.path.dirname(os.path.abspath(__file__))
DROP = '__DROP__'   # removes the whole line (fill_report.py)


BANK = {'label': 'BANK OF BARODA', 'realizable': 0.90, 'distress': 0.80, 'say_step': 5000, 'site_say_step': 1000,
        'defaults': {}}


def say_value(total, rep, step=5000):
    typed = num(rep.get('sayValue'))
    return int(typed) if typed else int(math.floor(total / step) * step)


def round10k(x):
    return int(round(x / 10000.0)) * 10000


def relation(text):
    """'S. Abdul Khader' → 'S/o. Sri. S. Abdul Khader'; keeps a relation the user already wrote."""
    t = (text or '').strip().rstrip('.')
    if not t:
        return ''
    if re.match(r'^(s|w|d|c)/o', t, re.I):
        return t
    return 'S/o. Sri. ' + re.sub(r'^(sri\.?|late)\s*', '', t, flags=re.I)


def final_values(f, case, rep, slot, total, step=None, bank=None):
    """Say / realizable / distress: Say rounded down (bank's step), realizable / distress = bank % of the
    total rounded to the nearest ₹10,000, plus the words."""
    bank = bank or BANK
    step = step or bank['say_step']
    r_pct, d_pct = rates_for(case, slot, bank['realizable'], bank['distress'])
    fmv = say_value(total, rep, step)
    base = fmv if bank.get('pct_of') == 'say' else total      # Canara: % of the rounded "Say" value
    step_v = bank.get('value_round', 10000)
    if callable(step_v):                                      # Union: depends on the size of the value
        step_v = step_v(base)
    realizable = int(round(base * r_pct / step_v)) * step_v
    distress = int(round(base * d_pct / step_v)) * step_v
    f.update({
        'fmv': inr(fmv), 'fmvWords': words(fmv), 'fmvWordsUpper': words(fmv).upper(),
        'realizable': inr(realizable), 'realizableWords': words(realizable),
        'distress': inr(distress), 'distressWords': words(distress),
        'realizablePct': f'{r_pct * 100:g}', 'distressPct': f'{d_pct * 100:g}',
    })
    return fmv, realizable, distress


def owners(f, case, rep):
    """Belongs To (one or two owners) and the Applicant; unused lines are dropped."""
    father = case.get('clientFatherName') or ''
    f['owner1Name'] = title_for(case.get('clientName') or '', father) or '---'
    f['owner1Rel'] = relation(father) or DROP
    f['owner1Addr'] = case.get('address') or DROP
    if rep.get('owner2Name'):
        f['owner2Name'] = title_for(rep['owner2Name'], rep.get('owner2Rel'))
        f['owner2Rel'] = relation(rep.get('owner2Rel')) or DROP
        f['owner2Addr'] = rep.get('owner2Addr') or DROP
    else:
        f['owner2Name'] = f['owner2Rel'] = f['owner2Addr'] = DROP
    if rep.get('owner3Name'):
        f['owner3Name'] = title_for(rep['owner3Name'], rep.get('owner3Rel'))
        f['owner3Rel'] = relation(rep.get('owner3Rel')) or ''
    else:
        f['owner3Name'] = f['owner3Rel'] = DROP
    # one-line forms: "Sri N. Ramana Kumar. S/o Sri N.V. Subbaiah."
    for n in (1, 2, 3):
        name, rel = f[f'owner{n}Name'], f[f'owner{n}Rel']
        f[f'ownerLine{n}'] = DROP if name == DROP else (f'{name}. {rel}.' if rel and rel != DROP else f'{name}.')
    if rep.get('applicantName'):
        f['applicantLabel'] = 'Applicant'
        f['applicantName'] = title_for(rep['applicantName'], rep.get('applicantRel'))
        f['applicantRel'] = relation(rep.get('applicantRel')) or DROP
        f['applicantAddr'] = rep.get('applicantAddr') or DROP
        f['applicantLine'] = f"{f['applicantName']},  {f['applicantRel']}." if f['applicantRel'] != DROP else f['applicantName']
    else:
        f['applicantLine'] = DROP
        f['applicantLabel'] = f['applicantName'] = f['applicantRel'] = f['applicantAddr'] = DROP


def amt(v, zero='0.00/-'):
    return f'{inr(v)}/-' if v else zero


# ---------------------------------------------------------------- HOUSE
HOUSE_DEFAULTS = {
    'purpose': 'Bank Purpose', 'mvCertificate': 'Copy Enclosed', 'postalAddress': 'As Of The Above',
    'cityTown': 'City', 'areaResidential': 'Residential Area', 'areaCommercial': 'NA', 'areaIndustrial': 'NA',
    'areaClass': 'Middle', 'areaUrban': 'Urban', 'govtEnactments': 'NA', 'agriConversion': 'NA', 'occupancy': 'Owner',
    'locality': 'Middle', 'surroundings': 'Residential', 'flooding': 'Nil', 'civicAmenities': 'At Walkable Distance',
    'levelOfLand': 'Level Ground', 'landShape': 'Rectangular', 'landUse': 'Residential', 'usageRestriction': 'Nil',
    'layoutApproved': 'No', 'cornerPlot': 'Intermittent Plot', 'roadFacilities': 'Provided', 'roadType': 'CC Road',
    'roadWidth': '20’0” Wide Road', 'landLocked': 'No', 'water': 'Available', 'sewerage': 'Provided',
    'power': 'Provided', 'advantage1': 'Good Residential Area', 'specialRemarks': 'Nil',
    'buildingType': 'Residential Building', 'constructionType': 'RCC Framed Structure', 'conditionExterior': 'Good',
    'conditionInterior': 'Good', 'planAuthority': 'Commissioner', 'planVerified': 'YES / NO', 'planComments': 'NIL',
    'buildingKind': 'Building', 'localBodyName': 'Kadapa Municipal Corporation', 'district': 'Y.S.R', 'place': 'Kadapa',
    'specGF_foundation': 'RCC FRAMED STRUCTURE\nPCC & WITH RR STONE MASONARY IN CM OVER SAND CUSHION & SETTLEMENT\nBED (1:4:8)',
    'specGF_basement': 'RR STONE MASONARY IN CM OF 0.60 HT FROM RL', 'specGF_superstructure': 'Brick Masonry with 1: 6',
    'specGF_joinery': 'Provided ( WOODEN DOORS & WINDOWS)', 'specGF_rccWorks': 'RCC Roof & RCC Columns',
    'specGF_plastering': 'Cement Plastering In Cm(1:4) 12mm Thick', 'specGF_flooring': 'Marble',
    'specGF_specialFinish': 'NA', 'specGF_roofing': 'PROVIDED', 'specGF_drainage': 'Provided',
    'compoundWall': '---', 'cwHeight': '--', 'cwLength': '--', 'cwType': '--', 'wiring': '& CONCEALED',
    'fittingsClass': 'ORDINARY', 'lightPoints': 'ADEQUATE', 'fanPoints': 'PROVIDED', 'plugPoints': 'PROVIDED',
    'electricalOther': 'MAIN SWITCHES', 'waterClosets': 'Two', 'washBasins': 'Two', 'urinals': '--', 'bathTubs': '--',
    'waterMeter': '--', 'otherFixtures': 'TAP CONNECTION PROVIDED',
}
HOUSE_EXTRAS = {
    'partC': ['ex_portico', 'ex_frontDoor', 'ex_sitOut', 'ex_ohTank', 'ex_gates'],
    'partD': ['am_wardrobes', 'am_glazedTiles', 'am_sinks', 'am_marble', 'am_interior', 'am_elevation',
              'am_paneling', 'am_aluminium', 'am_handRails', 'am_falseCeiling', 'am_lift'],
    'partE': ['mi_toilet', 'mi_lumber', 'mi_sump', 'mi_trees'],
    'partF': ['sv_water', 'sv_drainage', 'sv_compoundWall', 'sv_cbDeposits', 'sv_sump'],
}
FLOOR_CODES = {'ground': 'GF', 'first': 'FF', 'second': 'SF', 'third': 'TF', 'fourth': '4F'}


def build_house(case, temps, bank=None):
    bank = bank or BANK
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    f = common_fields(case, rep, {**HOUSE_DEFAULTS, **bank['defaults'].get('house', {})})
    owners(f, case, rep)
    survey, door = f['surveyNo'] or '---', f['doorNo'] or '---'
    village = rep.get('village') or '---'
    ward = rep.get('wardNo') or pd.get('wardNo') or '---'
    landmark = rep.get('landmark') or '---'
    lb = rep.get('localBodyName') or HOUSE_DEFAULTS['localBodyName']
    district = f['district']
    local_body = rep.get('localBody') or f'{lb} Of  {district}. (Dt).'
    f.update({
        'village': village, 'wardNo': ward, 'landmark': landmark, 'localBodyName': lb, 'localBody': local_body,
        'localBodyLine': f'{lb} of {district} (Dt).',
        'deedDate': ddmmyyyy(pd.get('deedDate')) or pd.get('deedYear') or '---',
        'planNo': f['planNo'] or 'NA', 'planDate': f['planDate'] or '---',
    })
    for side in ('North', 'South', 'East', 'West'):
        f[f'dimDeed{side}'] = rep.get(f'dimDeed{side}') or '---'
        f[f'dimActual{side}'] = rep.get(f'dimActual{side}') or f[f'dimDeed{side}']

    # Land
    deed_c = extent_in_cents(rep.get('extentDeedRaw') or pd.get('netExtent'))
    plan_c = extent_in_cents(rep.get('netExtentPlanRaw')) or deed_c
    considered = min(x for x in (deed_c, plan_c) if x) if (deed_c or plan_c) else 0
    rate_cent = num(rep.get('marketRatePerCent')) or num(pd.get('landRate')) * SQYD_PER_CENT
    guide = num(rep.get('guidelineRatePerSqyd')) or num(pd.get('guidelineRate'))
    land = money(considered * rate_cent)
    ext = bank.get('extent', extent_line)
    deed_line = ext(deed_c)
    f.update({
        'extentDeed': deed_line, 'extentActual': deed_line, 'extentSite': deed_line, 'totalExtent': deed_line,
        'sizeNorthSouth': deed_line, 'sizeEastWest': deed_line,
        'netExtentPlan': ext(plan_c, with_yards=False), 'extentConsidered': ext(considered, with_yards=False),
        'netExtentCents': f'{considered:.2f}',
        'marketRateLine': f'Rs {inr(rate_cent)}/-  Per Cent', 'guidelineRateLine': f'Rs {int(guide)}/- Sqyds' if guide else '---',
        'adoptedRateLine': f'{considered:.2f} Cents  X  Rs {inr(rate_cent)}/- Cent', 'landValueLine': f'= Rs {inr(land)}/-',
    })

    # Building — one row per floor, 1% depreciation per year of age
    age = int(num(pd.get('buildingAge')))
    life = int(num(rep.get('totalLife'), 60)) or 60
    dep_pct = min(age * num(rep.get('depreciationPerYear'), 1.0), 70.0)
    rate = num(rep.get('constructionRate')) or num((case.get('valuation') or {}).get('constructionRate')) or 3000
    rows, codes, plinth_lines, carpet_lines, building = [], [], [], [], 0
    for fl in (pd.get('siteValue') or {}).get('floors') or []:
        area = num(fl.get('value'))
        if not area:
            continue
        label = re.sub(r'\s*\(.*?\)', '', fl.get('label') or 'Floor').strip()
        code = next((v for k, v in FLOOR_CODES.items() if k in label.lower()), label)
        fl_rate = num(fl.get('rate')) or rate
        repl = money(area * fl_rate)
        dep = money(repl * dep_pct / 100)
        net = repl - dep
        building += net
        rows.append({'label': label.title().replace(' Floor', ' floor'), 'plinth': f'{area:.2f} Sqft',
                     'height': rep.get('floorHeight') or '10’', 'age': f'{age} Y', 'rate': f'Rs {int(rate)}/-',
                     'replacement': f'Rs {inr(repl)}/-', 'depPct': f'(-{dep_pct:g}%)', 'depAmount': f'Rs. {inr(dep) if dep else "000"}/-',
                     'net': f'Rs {inr(net)}/-'})
        codes.append(code)
        plinth_lines.append(f'{code} = {trunc2(area / SQFT_PER_SQM):.2f} Sqmt (or) {area:.2f} Sqft')
        carpet_lines.append(f'{code} = {trunc2(area * 0.85):.2f} Sqft')
    f.update({
        'buildingDesc': f"Residential Building ({' + '.join(codes) or 'GF'})",
        'yearOfConstruction': rep.get('yearOfConstruction') or str(dt.date.today().year - age),
        'ageLine': f'{age} Years' if age else 'New', 'remainingLifeLine': f'{max(life - age, 0)} Years',
        'floorsLine': f"({' + '.join(codes) or 'GF'})",
        'plinthPlan': '\n'.join(plinth_lines) or '---', 'plinthActual': '\n'.join(plinth_lines) or '---',
        'carpetPlan': rep.get('carpetArea') or '\n'.join(carpet_lines) or '---',
        'carpetActual': rep.get('carpetArea') or '\n'.join(carpet_lines) or '---',
        'buildingTotalLine': f'Rs {inr(building)}/-',
    })

    # Parts C–F
    parts = {}
    for part, keys in bank.get('extras', HOUSE_EXTRAS).items():
        tot = 0
        for k in keys:
            v = num(rep.get(k))
            tot += v
            f[k] = amt(v)
        parts[part] = tot
        f[part] = f'Rs {amt(tot)}'
    total = land + building + sum(parts.values())
    fmv, _, _ = final_values(f, case, rep, 'house', total, bank=bank)
    f.update({
        'absA': f'Rs  {inr(land)}/-', 'absB': f'Rs  {inr(building)}/-',
        **{k: f'Rs. {amt(parts[p])}' for k, p in (('absC', 'partC'), ('absD', 'partD'), ('absE', 'partE'), ('absF', 'partF'))},
        'absTotal': f'Rs. {inr(total)}/-', 'absSayAs': f'Rs. {inr(fmv)}/-',
        'declBackground': (f'Extent {considered:.2f} Cents of freehold land belonging to the client. The Land & Building '
                           f'bearing At In Site Survey No : {survey},  Door No : {door},  Ward No : {ward}, In {landmark}, '
                           f'{village} Village Filed At {local_body}'),
        'declPurpose': f'For collateral security. Manager, {bank["label"]}, {f["bankBranchUpper"]}, {district.upper()}. (DT).',
        'declDates1': f'Date of appointment: {f["inspectionDate"]}, ',
        'declDates2': f'Valuation date : {f["reportDate"]},', 'declDates3': f'Date of report : {f["reportDate"]},',
    })
    images = geo_and_photos(case, rep, f, temps, 4)
    apply_overrides(f, rep)
    return {'fields': f, 'rows': {'fl': rows}, 'images': images}


# ---------------------------------------------------------------- APARTMENT
APT_DEFAULTS = {
    'purpose': 'Collateral Security of Loan', 'mvCertificate': 'Copy Enclosed', 'planAuthority': 'Municipal Commissioner',
    'planVerified': 'YES/ NO', 'planComments': 'NIL', 'postalAddress': 'As Above', 'cityTown': 'Town',
    'areaResidential': 'Residential', 'areaCommercial': '-----', 'areaIndustrial': '-----', 'areaClass': 'High',
    'areaUrban': 'Urban', 'localBodyType': 'Municipal Corporation', 'govtEnactments': '------',
    'occupancy': 'Occupied Owners', 'aptNature': 'Residential', 'blockNo': '--', 'localityType': 'Residential',
    'structure': 'R.C.C. Framed', 'unitsLine': ' ', 'quality': 'Good', 'appearance': 'Good', 'maintenance': 'Good',
    'facilities': 'Yes', 'lift': 'Yes', 'protectedWater': 'Yes', 'sewerage': 'Yes', 'carParkingType': 'Open',
    'compoundWall': 'Yes', 'pavement': 'Yes', 'specRoof': 'R.C.C. Roof', 'specFlooring': 'TILES',
    'specDoors': 'WOODEN DOORS', 'specWindows': 'UPVC WINDOWS', 'specFittings': 'YES', 'specFinishing': 'YES',
    'houseTax': 'YES', 'taxPaidName': '--', 'electricityNo': '---', 'meterName': '---', 'flatMaintenance': 'Good',
    'fsi': '--', 'flatClass': 'I CLASS', 'usage': 'Residential', 'occupancy2': 'Owner', 'monthlyRent': '--',
    'marketability': 'Good', 'negatives': 'No', 'comparableRate': '---', 'adoptedBasicRate': '---',
    'advantages': 'It Is Good Residential Area, All Civic Amenities Are Very Near To In this Property, Like School, Colleges, Apartments, etc.,',
    'guidelineNote': 'Copy Enclosed', 'roadFacing': 'East', 'localBodyName': 'Kadapa Municipal Corporation',
    'district': 'Y.S.R', 'place': 'Kadapa', 'x_wardrobes': 'Rs 0.00/-', 'x_electrical': 'Rs 0.00/-',
    'x_showcases': '--', 'x_kitchen': '--', 'x_superfine': '--', 'x_interior': '--', 'x_grills': '--',
    'x_potential': '--', 'x_others': '--',
}
ORDINAL_SHORT = {'Ground': 'G', 'First': '1st', 'Second': '2nd', 'Third': '3rd', 'Fourth': '4th', 'Fifth': '5th',
                 'Sixth': '6th', 'Seventh': '7th', 'Eighth': '8th', 'Ninth': '9th', 'Tenth': '10th'}


def sqyd_of(raw):
    t = str(raw or '').lower()
    return num(t) if ('yd' in t or 'yard' in t) else extent_in_cents(raw) * SQYD_PER_CENT


def build_apartment(case, temps, bank=None):
    bank = bank or BANK
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    f = common_fields(case, rep, {**APT_DEFAULTS, **bank['defaults'].get('apartment', {})})
    owners(f, case, rep)
    survey, door = f['surveyNo'] or '---', f['doorNo'] or '---'
    flat = pd.get('flatNo') or rep.get('flatNo') or '---'
    floor = apgb.floor_word(rep.get('floorName') or pd.get('floorNo'))
    village = rep.get('village') or '---'
    landmark = rep.get('landmark') or '---'
    ward = rep.get('wardNo') or pd.get('wardNo') or '---'
    district = f['district']
    lb = rep.get('localBodyName') or APT_DEFAULTS['localBodyName']
    apt = rep.get('aptName') or pd.get('apartmentName') or '---'
    f.update({
        'aptName': apt, 'flatNo': flat, 'floorName': floor, 'floorNameUpper': floor.upper(),
        'floorOrdinal': ORDINAL_SHORT.get(floor, floor), 'floorOrdinalUpper': ORDINAL_SHORT.get(floor, floor).upper(),
        'floorLine': f'{floor} Floor', 'village': village, 'landmark': landmark,
        'areaNameComma': f" {rep['areaName']}," if rep.get('areaName') else ' ',
        'villageLine': f'{village} Village Field', 'mandalDistrict': rep.get('mandalDistrict') or f'Kadapa, {district} (DT)',
        'aptLocation': f'{landmark}, {village} Division, Kadapa, {district} (Dt).',
        'surveyLine': f'Survey No :- {survey}', 'wardLine': f'Ward No: {ward}', 'doorLine': f'Door No : {door},',
        'localBodyLine': f'{lb}, {district} (Dt).', 'localBody': rep.get('localBody') or f'{lb} of  {district}(Dt).',
        'localBodyUpper': f'{lb.upper()} OF {district} (Dt).',
        'deedDate': ddmmyyyy(pd.get('deedDate')) or pd.get('deedYear') or '---',
        'planLine': f'B.A.NO: {f["planNo"]}, Dt: {f["planDate"]}' if f['planNo'] else 'NA',
        'planNo': f['planNo'] or 'NA', 'planDate': f['planDate'] or '---',
        'floorsDesc': rep.get('floorsDesc') or '---', 'floorsShort': rep.get('floorsShort') or rep.get('floorsDesc') or '---',
        'bankBranchLine': f'{case.get("bankBranch") or "---"}.',
        'owner1NameLine': f'{f["owner1Name"]}, ', 'owner1RelLine': f'{f["owner1Rel"]}.' if f['owner1Rel'] != DROP else ' ',
        'deedExecutant': rep.get('deedExecutant') or f'{f["owner1Name"]}, ',
        'deedExecutantRelation': rep.get('deedExecutantRelation') or (f'{f["owner1Rel"]}.' if f['owner1Rel'] != DROP else ' '),
        'taxAmountLine': f"Rs {inr(num(rep.get('taxAmount')))}/-" if rep.get('taxAmount') else '--',
    })
    for side in ('North', 'South', 'East', 'West'):
        f[f'fb{side}'] = rep.get(f'fb{side}') or '---'

    # Land: the flat's undivided share (UDS) of the whole site, valued per Sqyd
    parent_raw = rep.get('parentExtentDeedRaw')
    parent_yd = sqyd_of(parent_raw)
    parent_c = parent_yd / SQYD_PER_CENT
    uds_yd = sqyd_of(rep.get('udsDeedRaw') or pd.get('netExtent'))
    rate_yd = num(rep.get('landRatePerSqyd')) or num(pd.get('landRate'))
    land = money(uds_yd * rate_yd)
    parent_line = f'{trunc2(parent_yd * 9):.2f} Sqft (or) {parent_yd:.2f} Sqyd (or) {parent_c:.2f} Cents' if parent_yd else '---'
    plan_c = extent_in_cents(rep.get('netExtentPlanRaw'))
    f.update({
        'parentExtentLine': parent_line, 'parentSqyd': f'{parent_yd:.2f}', 'parentSqydLine': f'{parent_yd:.2f} Sqyds',
        'netSitePlan': f'{trunc2(plan_c * apgb.SQM_PER_CENT):.2f} Sqmts (or) {plan_c:.2f} Cents' if plan_c else '---',
        'udsShort': f'{uds_yd:.2f} Sqyds', 'udsLine': f'{uds_yd:.2f} Sqyds Out Of {parent_yd:.2f} Sqyds',
        'udsDims': f'{uds_yd:.2f} Sqyd',
        'landCalc': f'= {uds_yd:.2f} Sqyds x Rs {inr(rate_yd)}/- Sqyd= Rs {inr(land)}/-',
        'landValueLine': f'Rs {inr(land)}/-',
    })
    for side in ('North', 'South', 'East', 'West'):
        f[f'dimDeed{side}'] = rep.get(f'dimDeed{side}') or (f'{parent_yd:.2f} Sqyd (or) {parent_c:.2f} Cents' if parent_yd else '---')
        f[f'dimActual{side}'] = rep.get(f'dimActual{side}') or f[f'dimDeed{side}']

    # Flat: plinth x rate, 1% depreciation per year of age
    plinth = apgb.sqft_of(rep.get('plinthArea')) or num((pd.get('siteValue') or {}).get('plinthArea')) or \
        sum(num(x.get('value')) for x in ((pd.get('siteValue') or {}).get('floors') or []))
    carpet = apgb.sqft_of(rep.get('carpetArea')) or plinth * 0.85
    rate = num(rep.get('constructionRate')) or num((case.get('valuation') or {}).get('constructionRate')) or 2200
    age = int(num(pd.get('buildingAge')))
    life = int(num(rep.get('totalLife'), 60)) or 60
    dep_pct = min(age * num(rep.get('depreciationPerYear'), 1.0), 70.0)
    bld = money(plinth * rate)
    dep = money(bld * dep_pct / 100)
    net = bld - dep
    composite = net + land
    extras = 0
    for k in ('x_wardrobes', 'x_showcases', 'x_kitchen', 'x_superfine', 'x_interior', 'x_electrical',
              'x_grills', 'x_potential', 'x_others'):
        v = num(rep.get(k))
        if v:
            f[k] = f'Rs {inr(v)}/-'
            extras += v
    total = composite + extras
    fmv, _, _ = final_values(f, case, rep, 'apartment', total, bank=bank)
    fee = num(rep.get('fee')) or 5000
    built_up = apgb.sqft_of(rep.get('builtUpArea')) or plinth
    f.update({
        'yearOfConstruction': rep.get('yearOfConstruction') or str(dt.date.today().year - age),
        'plinthLine': f'{plinth:.2f} Sqft', 'carpetLine': f'{carpet:.2f} Sqft',
        'buildingCalc': f'Building = {plinth:.2f} Sqft x Rs {int(rate)}/- =  Rs {inr(bld)}/-',
        'replacementLine': f'Rs {inr(bld)}/-', 'ageLine': f'{age} Year', 'remainingLifeLine': f'{max(life - age, 0)} Years',
        'deprLine': f'{dep_pct:g}%  =   Rs {inr(dep)}/-', 'deprValueLine': f'Rs {inr(net)}/-',
        'deprBuildingLine': f'Rs {inr(net)}/-', 'compositeLine': f'Rs. {inr(composite)}/-',
        'compositeLine2': f'Rs {inr(composite)}/-', 'unitRateLine': f'Rs {trunc2(composite / plinth):.2f}/-' if plinth else '--',
        'grandTotalLine': f'Rs   {inr(total)}/-', 'sayLine': f'Say {inr(fmv)}/-',
        'fee': inr(fee), 'feeWords': words(fee),
        'declBackground': (f'1) {uds_yd:.2f} Sqyds of freehold land belonging to the client. The land bearing At Residential '
                           f'Flat in “ {apt} ”, Flat No : {flat} In  {floor} Floor, Site Survey No’s : {survey}, Door No. {door}, '
                           f'{landmark}, {village} Division At {f["localBody"]}'),
        'declBuilding': f'2) Residential Flat on the said land. Built up area : {built_up:.2f} Sqft',
        'declPurpose': f'For collateral security. Manager, {bank["label"]} {f["bankBranchUpper"]}.',
        'declDates1': f'Date of appointment: {f["inspectionDate"]}, ',
        'declDates2': f'Valuation date: {f["reportDate"]}, ', 'declDates3': f'Date of report: {f["reportDate"]}.',
    })
    images = geo_and_photos(case, rep, f, temps, 6)
    f['latitudeLine'] = f"{f['latitude']} N" if f['latitude'] != '---' else '---'
    f['longitudeLine'] = f"{f['longitude']} E" if f['longitude'] != '---' else '---'
    apply_overrides(f, rep)
    return {'fields': f, 'rows': {}, 'images': images}


# ---------------------------------------------------------------- OPEN SITE (one or two deeds)
SITE_DEFAULTS = {
    'purpose': 'For Bank Purpose', 'mvCertificate': 'Copy Enclosed', 'postalAddress': 'As Of The Above',
    'cityTown': 'Rural', 'areaResidential': 'Residential Area', 'areaCommercial': 'NA', 'areaIndustrial': 'NA',
    'areaClass': 'Middle', 'areaUrban': 'Rural', 'govtEnactments': 'NA', 'agriConversion': 'NA', 'occupancy': 'Owner',
    'locality': 'Middle', 'surroundings': 'Residential', 'flooding': 'Nil', 'civicAmenities': 'At Walkable Distance',
    'levelOfLand': 'Level Ground', 'landShape': 'Rectangular', 'landUse': 'Residential', 'usageRestriction': 'Nil',
    'layoutApproved': 'NA', 'cornerPlot': 'Intermittent Plot', 'roadFacilities': 'Provided', 'roadType': 'CC Road',
    'roadWidth': '30’0” Ft Wide Road', 'yearOfConstruction': '0', 'ageLine': '0 Y', 'remainingLifeLine': '60 Years',
    'landLocked': 'No', 'water': 'Available', 'sewerage': 'Provided', 'power': 'Provided',
    'advantage1': 'Good Residential Area', 'specialRemarks': 'Nil', 'siteType': 'Residential Vacant Site',
    'district': 'Y.S.R', 'place': 'Kadapa',
}


def cents_line(c):
    """'212.09 Sqmts (or) 253.33 Sqyds (or) 5.234 Cents' (Bank of Baroda prints cents with 3 decimals)."""
    return f'{trunc2(c * apgb.SQM_PER_CENT):.2f} Sqmts (or) {trunc2(c * SQYD_PER_CENT):.2f} Sqyds (or) {c:.3f} Cents'


def build_open_site(case, temps, bank=None):
    bank = bank or BANK
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    f = common_fields(case, rep, {**SITE_DEFAULTS, **bank['defaults'].get('open_site', {})})
    owners(f, case, rep)
    survey = f['surveyNo'] or '---'
    plot = pd.get('plotNo') or '---'
    village = rep.get('village') or '---'
    district = f['district']
    mandal = rep.get('mandal') or 'Kadapa'
    local_body = rep.get('localBody') or f'{mandal} Mandal Of {district}. (Dt).'
    loc = rep.get('locationText') or f'{village} Village'
    two = bool(rep.get('deed2No'))
    d1 = extent_in_cents(rep.get('extentDeedRaw') or pd.get('netExtent'))
    d2 = extent_in_cents(rep.get('deed2ExtentRaw')) if two else 0
    total_c = d1 + d2
    plan_c = extent_in_cents(rep.get('netExtentPlanRaw'))
    considered = min(total_c, plan_c) if plan_c else total_c
    plot1 = rep.get('deed1PlotNo') or plot
    f.update({
        'plotNo': plot, 'village': village, 'locationText': loc, 'localBody': local_body,
        'localBodyLine': f'{mandal} Mandal of {district} (Dt).', 'localBodyType': rep.get('localBodyType') or f'Panchayath Limit, {mandal} Mandal of {district}. (Dt).',
        'deedDate': ddmmyyyy(pd.get('deedDate')) or pd.get('deedYear') or '---',
        'planLine': f'B.A. No : {f["planNo"]}, Dt : {f["planDate"]}' if f['planNo'] else 'NA',
        'deed1Cents': f'{d1:.3f}', 'totalCents': f'{total_c:.3f}',
        'deed1Header': f'As Per Deed {pd.get("deedNo") or "---"} Plot No : {plot1}',
        'deed1ExtentLine': cents_line(d1), 'totalExtentLine': cents_line(total_c), 'extentConsidered': cents_line(considered),
        'netExtentPlan': cents_line(plan_c) if plan_c else 'NA',
    })
    if two:
        f.update({'deed2No': rep['deed2No'], 'deed2Date': ddmmyyyy(rep.get('deed2Date')) or '---', 'deed2Cents': f'{d2:.3f}',
                  'deed2Header': f'As Per Deed {rep["deed2No"]} Plot No : {rep.get("deed2PlotNo") or "---"}',
                  'deed2ExtentLine': cents_line(d2)})
    else:
        # one deed: the second deed's line goes away and its column stays blank
        f.update({'deed2No': DROP, 'deed2Date': DROP, 'deed2Cents': DROP, 'deed2Header': ' ', 'deed2ExtentLine': ' '})
    for side in ('North', 'South', 'East', 'West'):
        f[f'dimDeed{side}'] = rep.get(f'dimDeed{side}') or '---'
        f[f'bd2{side}'] = rep.get(f'bd2{side}') or (' ' if not two else '---')
        f[f'dim2{side}'] = rep.get(f'dim2{side}') or (' ' if not two else '---')
        f[f'dimTotal{side}'] = rep.get(f'dimTotal{side}') or f[f'dimDeed{side}']
    rate = num(rep.get('marketRatePerCent')) or num(pd.get('landRate')) * SQYD_PER_CENT
    guide = num(rep.get('guidelineRatePerSqyd')) or num(pd.get('guidelineRate'))
    land = money(considered * rate)
    fmv, _, _ = final_values(f, case, rep, 'openSite', land, step=bank['site_say_step'], bank=bank)
    f.update({
        'marketRateLine': f' Rs {inr(rate)}/- Cent', 'guidelineRateLine': f'Rs {inr(guide)}/- Sqyd' if guide else '---',
        'adoptedRateLine': f'{considered:.3f} Cents  X  Rs {inr(rate)}/- Cent', 'landValueLine': f'= Rs {inr(land)}/-',
        'absA': f'Rs. {inr(land)}/-', 'absTotal': f'Rs. {inr(land)}/-', 'absSayAs': f'Rs. {inr(fmv)}/-',
        'declBackground': (f'Extent Of {considered:.3f} Cents of freehold land belonging to the client. The land bearing At '
                           f'In Site Survey No : {survey}, Plot No’s : {plot}, In {loc}, {village} Village Field At  {local_body}'),
        'declPurpose': f'For collateral security. Manager, {bank["label"]} {f["bankBranchUpper"]}, {district}. (Dt).',
        'declDates1': f'Date of appointment: {f["inspectionDate"]}, ',
        'declDates2': f'Valuation date : {f["reportDate"]},', 'declDates3': f'Date of report : {f["reportDate"]}.',
    })
    images = geo_and_photos(case, rep, f, temps, 11)
    apply_overrides(f, rep)
    return {'fields': f, 'rows': {}, 'images': images}


# ---------------------------------------------------------------- AGRICULTURE (several land items)
AGRI_DEFAULTS = {
    'purpose': 'For Bank Facility', 'mvCertificate': 'Copy Enclosed', 'pattaPassbook': '--', 'doorNo': '--',
    'postalAddress': 'As Of The Above', 'localBodyType': 'Municipality Limit', 'govtEnactments': 'NA',
    'agriConversion': 'NA', 'occupancy': 'Owner', 'income': ' ', 'irrigation': 'Agriculture', 'flooding': 'Nil',
    'levelOfLand': 'Level Ground', 'landLocked': 'No', 'cottages': 'No', 'fencing': 'No', 'generalCondition': 'Good',
    'soilQuality': 'Good', 'onHighway': 'Yes', 'crops': 'All Type of Crops', 'waterElectricity': 'Yes',
    'advantage1': 'All Type of Crops', 'disadvantage1': 'Nil', 'specialRemarks': 'Nil', 'district': 'Y.S.R',
    'place': 'Kadapa', 'mandal': 'Kadapa',
}


def build_agriculture(case, temps, bank=None):
    bank = bank or BANK
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    f = common_fields(case, rep, {**AGRI_DEFAULTS, **bank['defaults'].get('agriculture', {})})
    owners(f, case, rep)
    mandal = rep.get('mandal') or AGRI_DEFAULTS['mandal']
    district = f['district']
    # Land items: report.items = [{survey, extent (acres, e.g. '0.16'), north, south, east, west}, …]
    items = [i for i in (rep.get('items') or []) if i]
    if not items:
        bd = pd.get('boundariesDoc') or {}
        items = [{'survey': pd.get('surveyNo'), 'extent': rep.get('extentDeedRaw') or pd.get('netExtent'), **bd}]
    acres = [apgb.acres_of(i.get('extent')) if re.search(r'[a-z]', str(i.get('extent') or ''), re.I)
             else num(i.get('extent')) for i in items]
    total_ac = sum(acres)
    first = items[0]
    f.update({
        'surveyNo': f['surveyNo'] or ', '.join(str(i.get('survey') or '') for i in items),
        'khathaNo': pd.get('khathaNo') or rep.get('khathaNo') or '---',
        'village': rep.get('village') or '---', 'landmark': rep.get('landmark') or '---', 'mandal': mandal,
        'localBody': rep.get('localBody') or f'{mandal} Mandal of {district} (Dt).',
        'totalAc': f'{total_ac:.2f}', 'extentLine': f'Ac {total_ac:.2f} Cent',
        'it1Survey': first.get('survey') or '---', 'it1Extent': f'{acres[0]:.2f}',
        **{f'it1{side.title()}': first.get(side) or '---' for side in ('north', 'south', 'east', 'west')},
    })
    rows = [{'blank': ' ', 'no': f'{n:02d}', 'survey': it.get('survey') or '---', 'extent': f'{ac:.2f}',
             **{side: it.get(side) or '---' for side in ('north', 'south', 'east', 'west')}}
            for n, (it, ac) in enumerate(zip(items[1:], acres[1:]), start=2)]
    rate = num(rep.get('ratePerAcre')) or num(rep.get('marketRatePerCent')) * 100
    guide = num(rep.get('guidelineRatePerAcre'))
    land = money(total_ac * rate)
    fmv, _, _ = final_values(f, case, rep, 'agriculture', land, bank=bank)
    f.update({
        'marketRateLine': f'Rs {inr(rate)}/- Acre', 'guidelineRateLine': f'Rs {inr(guide)}/- Acre' if guide else '---',
        'adoptedRateLine': f'Ac {total_ac:.2f} Cents  X  Rs {inr(rate)}/- Acre', 'landValueLine': f'= Rs {inr(land)}/-',
        'absA': f'Rs.  {inr(land)}/-', 'absTotal': f'Rs  {inr(land)}/-', 'absSayAs': f'Rs  {inr(fmv)}/-',
    })
    images = geo_and_photos(case, rep, f, temps, 2)
    apply_overrides(f, rep)
    return {'fields': f, 'rows': {'ag': rows}, 'images': images}


BUILDERS = {'house': build_house, 'apartment': build_apartment, 'open_site': build_open_site,
            'agriculture': build_agriculture}
TEMPLATES = {name: f'bob_{name}.docx' for name in BUILDERS}
format_for = apgb.format_for


def build(case, out_path):
    fmt = format_for(case)
    if fmt not in BUILDERS:
        raise NotImplementedError(f'Bank of Baroda {fmt} format not built yet')
    temps = []
    job = BUILDERS[fmt](case, temps)
    job['template'] = os.path.join(HERE, 'templates', TEMPLATES[fmt])
    job['out'] = out_path
    return job, temps

"""
Shriram Finance Ltd report builder (the lender's own formats in shriram_source/).

Shriram's rules, read from the lender's open-site sample:
  • Land = plot area in Sqft x rate per Sqft (4360.00 x 1,721 = 75,03,560)
  • "Say" = rounded down to ₹10,000 (→ 75,00,000), unless the engineer types it
  • Forced / distress sale = 80% of the Say (→ 60,00,000); the form has no realizable line
"""
import os

import apgb
import bob
from apgb import inr, num, trunc2, SQYD_PER_CENT, SQM_PER_CENT, apply_overrides
from union import dotted, cents_txt

HERE = os.path.dirname(os.path.abspath(__file__))
DROP = bob.DROP
SITE_PCT = (0.90, 0.80)


def build_open_site(case, temps, bank=None):
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    f = apgb.common_fields(case, rep, {'district': 'Y.S.R', 'place': 'Kadapa'})
    bob.owners(f, case, rep)
    district = f['district']
    lb = rep.get('localBodyName') or 'Kadapa Municipal Corporation'
    deed_yd = bob.sqyd_of(rep.get('extentDeedRaw') or pd.get('netExtent'))
    plan_yd = bob.sqyd_of(rep.get('netExtentPlanRaw')) or deed_yd
    yd = min(x for x in (deed_yd, plan_yd) if x) if (deed_yd or plan_yd) else 0
    sqft = round(yd * 9, 2)
    rate_ft = num(rep.get('landRatePerSqft')) or (num(rep.get('landRatePerSqyd')) or num(pd.get('landRate'))) / 9
    rate_ft = round(rate_ft, 2)
    land = apgb.money(sqft * rate_ft)
    fmv = num(rep.get('sayValue')) or int(land // 10000) * 10000
    _, d_pct = bob.rates_for(case, 'openSite', *SITE_PCT)
    distress = int(round(fmv * d_pct / 10000)) * 10000
    guide = num(rep.get('guidelineRatePerSqyd')) or num(pd.get('guidelineRate'))
    cents = yd / SQYD_PER_CENT if yd else 0

    rel = f.get('owner1Rel')
    name_line = f'{f["owner1Name"]}, {rel}.' if rel not in (None, DROP, '') else f'{f["owner1Name"]}.'
    addr = (case.get('address') or '').strip()
    addr_a, _, addr_b = addr.rpartition(',') if addr.count(',') >= 1 else (addr, '', '')
    door, ward = pd.get('doorNo') or '', rep.get('wardNo') or pd.get('wardNo') or ''
    plot, survey = pd.get('plotNo') or '', f['surveyNo'] or '---'
    f.update({
        'applicantLine': rep.get('applicantLine') or name_line, 'ownerLine1': name_line,
        'owner1AddrA': (addr_a + ',') if addr_b else (addr or ' '), 'owner1AddrB': addr_b.strip() or ' ',
        'bankBranchName': (case.get('bankBranch') or '---').strip(), 'personMet': rep.get('personMet') or name_line,
        # the form prints the labels itself: 'Door /Flat No: Ward No: 90,' and 'Plot No: Survey No: 17,'
        'doorWard': (f'{door}, ' if door else '') + (f'Ward No: {ward},' if ward else ''),
        'plotSurvey': (f'{plot}, ' if plot else '') + f'{survey},',
        'street': rep.get('street') or rep.get('landmark') or '---', 'landmark': rep.get('nearBy') or rep.get('landmark') or '---',
        'villageField': f'{rep.get("village") or pd.get("village") or "---"} Village Field',
        'localBodyLine': f'{lb} Of {dotted(district)} (Dt).', 'pinCode': rep.get('pinCode') or '---',
        'relationWithApplicant': rep.get('relationWithApplicant') or 'Self',
        'deedNo': pd.get('deedNo') or '---', 'deedDate': apgb.ddmmyyyy(pd.get('deedDate')) or '---',
        'extentFull': (f'{sqft:.2f} Sqft (or) {trunc2(cents * SQM_PER_CENT):.2f} Sqmts (or) {yd:.2f} Sqyds '
                       f'(or) {cents_txt(cents)} Cents'),
        'areaSqftLine': f'{sqft:.2f} Sqft', 'rateSqftLine': f'{rate_ft:.2f}/Sft', 'landValueRs': f'Rs {inr(land)}/-',
        'fmvRs': f'Rs {inr(fmv)}/-', 'distressRs': f'Rs {inr(distress)}/-',
        'guidelineValueRs': f'Rs {inr(apgb.money(yd * guide))}/-' if guide else '---',
        'roadWidth': rep.get('roadWidth') or pd.get('roadWidth') or 'Wide Road',
        'branchDistance': rep.get('branchDistance') or '---',
    })
    for side in ('North', 'South', 'East', 'West'):
        f[f'dimActual{side}'] = rep.get(f'dimActual{side}') or rep.get(f'dimDeed{side}') or '---'
    images = apgb.geo_and_photos(case, rep, f, temps, 6)
    apply_overrides(f, rep)
    return {'fields': f, 'rows': {}, 'images': images}


# ---------------------------------------------------------------- HOUSE
# From the house sample: land = plan net extent (Sqft) x rate per Sqft; building = built-up Sqft x rate
# (no depreciation in Shriram's form); + other items; Say ↓₹10,000; forced / distress = 90% of the Say.
HOUSE_PCT = (0.95, 0.90)
EXTRA_KEYS = ['ex_portico', 'ex_frontDoor', 'ex_sitOut', 'ex_ohTank', 'ex_gates', 'am_wardrobes', 'am_glazedTiles',
              'am_sinks', 'am_marble', 'am_interior', 'am_elevation', 'am_paneling', 'am_aluminium', 'am_handRails',
              'am_falseCeiling', 'mi_toilet', 'mi_lumber', 'mi_sump', 'mi_trees', 'sv_water', 'sv_drainage',
              'sv_compoundWall', 'sv_cbDeposits', 'sv_pavement']


def build_house(case, temps, bank=None):
    import datetime as dt
    job = build_open_site(case, temps, bank)
    f = job['fields']
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    deed_yd = bob.sqyd_of(rep.get('extentDeedRaw') or pd.get('netExtent'))
    plan_yd = bob.sqyd_of(rep.get('netExtentPlanRaw')) or deed_yd
    yd = min(x for x in (deed_yd, plan_yd) if x) if (deed_yd or plan_yd) else 0
    sqft = round(yd * 9, 2)
    rate_ft = num(rep.get('landRatePerSqft')) or (num(rep.get('landRatePerSqyd')) or num(pd.get('landRate'))) / 9
    rate_ft = round(rate_ft, 2)
    land = apgb.money(sqft * rate_ft)

    codes, built = [], 0.0
    for fl in (pd.get('siteValue') or {}).get('floors') or []:
        area = num(fl.get('value'))
        if area:
            built += area
            label = (fl.get('label') or '').lower()
            codes.append(next((v for k, v in bob.FLOOR_CODES.items() if k in label), 'GF'))
    built = num(rep.get('plinthArea')) or built
    c_rate = num(rep.get('constructionRate')) or num((case.get('valuation') or {}).get('constructionRate')) or 2200
    building = apgb.money(built * c_rate)
    other = num(rep.get('otherItems')) or sum(num(rep.get(k)) for k in EXTRA_KEYS)
    total = land + building + other
    fmv = num(rep.get('sayValue')) or int(total // 10000) * 10000
    _, d_pct = bob.rates_for(case, 'house', *HOUSE_PCT)
    distress = int(round(fmv * d_pct / 10000)) * 10000
    age = int(num(pd.get('buildingAge')))
    life = int(num(rep.get('totalLife'), 60)) or 60
    year = rep.get('yearOfConstruction') or (dt.date.today().year - age if age else '')
    floors_word = {'GF': 'Ground Floor', 'FF': 'Ground + First Floor', 'SF': 'Ground + Two Floors',
                   'TF': 'Ground + Three Floors'}.get(codes[-1] if codes else 'GF', 'Ground Floor')
    door, survey, plot = pd.get('doorNo') or '', f['surveyNo'] or '---', pd.get('plotNo') or ''
    def ext_doc(y):
        c = y / SQYD_PER_CENT if y else 0
        return f'{y * 9:.2f} Sqft (or) {y:.2f} Sqyds (or) {cents_txt(c)} Cents'
    def ext_plan(y):
        c = y / SQYD_PER_CENT if y else 0
        return f'{y * 9:.2f} Sqft (Or) {trunc2(c * SQM_PER_CENT):.2f} Sqmts (Or) {cents_txt(c)} Cents'
    addr = (case.get('address') or '').strip()
    f.update({
        'owner1AddrFull': addr or ' ',
        'doorLineH': f'Door No: {door},' if door else '---', 'surveyPlotH': f'Survey No: {survey},' + (f' Plot No: {plot},' if plot else ''),
        'deedDateSlash': (apgb.ddmmyyyy(pd.get('deedDate')) or '---').replace('-', '/'),
        'extentDocLine': ext_doc(deed_yd), 'extentPlanLine': ext_plan(yd),
        'builtUpLine': f'{trunc2(built / 10.7639):.2f} Sqmts (Or) {built:.2f} Sqft' if built else '---',
        'carpetLine': rep.get('carpetArea') or (f'{trunc2(built * 0.85 / 10.7639):.2f} Sqmts (Or) {built * 0.85:.2f} Sqft' if built else '---'),
        'ageLine': f'{age} Years ({year})' if age else 'New', 'residualLife': f'{max(life - age, 0)} Years',
        'constructionNature': pd.get('structureType') or rep.get('structureType') or 'RCC Framed',
        'flooringType': pd.get('flooringType') or rep.get('flooringType') or 'Granite',
        'roofingType': rep.get('roofingType') or 'Standard / RCC Roofing', 'floorsWord': rep.get('floorsDesc') or floors_word,
        'completionLine': rep.get('completionLine') or '100 % Completed,', 'floorCodes': ' + '.join(codes) or 'GF',
        'areaSqftLine': f'{sqft:.2f} Sqft', 'rateSqftLine': f'{rate_ft:.2f}/Sft', 'landValueRs': f'Rs {inr(land)}/-',
        'builtSqftLine': f'{built:.2f} Sqft' if built else '---', 'buildRateLine': f'{int(c_rate)}/Sft',
        'buildingValueRs': f'Rs {inr(building)}/-' if building else '----',
        'otherItemsRs': f'Rs {inr(other)}/-' if other else '----', 'totalRs': f'Rs {inr(total)}/-',
        'fmvRs': f'Rs {inr(fmv)}/-', 'distressRs': f'Rs {inr(distress)}/-',
    })
    apply_overrides(f, rep)
    return job


BUILDERS = {'open_site': build_open_site, 'house': build_house}
TEMPLATES = {name: f'shriram_{name}.docx' for name in BUILDERS}
format_for = apgb.format_for


def build(case, out_path):
    fmt = format_for(case)
    if fmt not in BUILDERS:
        raise NotImplementedError(f'Shriram Finance {fmt} format not built yet')
    temps = []
    job = BUILDERS[fmt](case, temps)
    job['template'] = os.path.join(HERE, 'templates', TEMPLATES[fmt])
    job['out'] = out_path
    return job, temps

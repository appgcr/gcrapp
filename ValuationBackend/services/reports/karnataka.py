"""
Karnataka Bank report builder (the bank's own formats in karnataka_source/).

Karnataka Bank's rules, read from the bank's sample reports:
  • Land = extent (Sqyds) x rate per Sqyd; building = plinth x rate (the total adds the building at its
    present cost, as the bank's sample does: 7,29,58,644 + 1,01,32,200 = 8,30,90,844)
  • "Say" = the total rounded down to ₹10,000 (8,30,90,844 → 8,30,90,000), unless the engineer types it
  • Forced-sale (distress) value = 75% of the Say, rounded to the nearest ₹10,000 (→ 6,23,20,000);
    realizable 90% (Settings → Banks)
"""
import os
import re

import apgb
import bob
from apgb import inr, num, words, trunc2, SQYD_PER_CENT, SQFT_PER_SQM, apply_overrides
from union import dotted, cents_txt
from pnb import owner_fields

HERE = os.path.dirname(os.path.abspath(__file__))
DROP = bob.DROP
DROP_ROW = '__DROPROW__'
BANK = {'label': 'Karnataka Bank', 'realizable': 0.90, 'distress': 0.75, 'say_step': 10000, 'site_say_step': 10000,
        'value_round': 10000, 'pct_of': 'say', 'defaults': {}}
DEFAULTS = {
    'purpose': 'BANK ADVANCE', 'accompaniedBy': 'Owner & Manager of Karnataka Bank', 'bankOfficial': '---',
    'bankOfficialRole': 'Branch Head,', 'briefDesc': ' Residential Land & Building', 'roadWidth': 'Above 30.00 Ft Wide Road',
    'constructionType': 'RCC Framed Structured', 'buildingDesc': 'Residential Land & Building',
    'constructionType2': 'R.C.C Framed Structured', 'buildingKind': 'Residential Building', 'occupancy': 'Occupied By Owners',
    'district': 'Y.S.R', 'place': 'Kadapa',
}


def kbl_words(n):
    """'EIGHT CRORES THIRTY LAKHS NINETY THOUSANDS' — the bank's file pluralises thousand."""
    w = re.sub(r'^Rupees\s+|\s+Only$', '', words(n)).upper()
    return w.replace('THOUSAND', 'THOUSANDS')


def common(f, case, rep, extent_yd):
    pd = case.get('propertyDetails') or {}
    district = f['district']
    lb = rep.get('localBodyName') or 'Grama Panchayat'
    deeds = [(pd.get('deedNo'), rep.get('extentDeedRaw') or pd.get('netExtent'))]
    for k in ('2', '3'):
        if rep.get(f'deed{k}No'):
            deeds.append((rep[f'deed{k}No'], rep.get(f'extent{k}Raw')))
    for i in range(3):
        if i < len(deeds):
            no, raw = deeds[i]
            f[f'deedLine{i + 1}'] = f'        Deed No       :  {no or "---"}\t\t\t      Extent   :    {bob.sqyd_of(raw):.2f} Sqyds '
        else:
            f[f'deedLine{i + 1}'] = DROP
    bd_doc, bd_act = pd.get('boundariesDoc') or {}, pd.get('boundariesActual') or {}
    for k in (1, 2, 3):
        it = (rep.get('deedBoundaries') or [None, None, None])[k - 1] if k > 1 else bd_doc
        have = k == 1 or (k - 1 < len(deeds) and it)
        f[f'bd{k}Head'] = (f'As per deed ({deeds[k - 1][0]}), ' if k - 1 < len(deeds) else ' ') if have else DROP_ROW
        for side in ('East', 'West', 'North', 'South'):
            v = (it or {}).get(side.lower()) if have else None
            f[f'bd{k}{side}'] = (v or '---') if have else DROP_ROW
            act = bd_act.get(side.lower()) if k == 1 else None
            f[f'bd{k}Actual{side}'] = (act or f[f'bd{k}{side}']) if have else DROP_ROW
    loc = (f'Site Survey No : {f["surveyNo"] or "---"}, Door No : {f["doorNo"] or "---"}, Ward No: {rep.get("wardNo") or "---"}, '
           f'In {rep.get("landmark") or "---"}, {rep.get("village") or "---"} Village Field, {lb}, '
           f'{rep.get("mandal") or "---"} Mandal of {dotted(district)} (Dt).')
    def _has(v):
        return bool(v) and str(v).strip(' -,.') not in ('', 'NA')
    parts = [f'Sy.No. {f["surveyNo"]}' if _has(f.get('surveyNo')) else '',
             f'D.No.{f["doorNo"]}' if _has(f.get('doorNo')) else '']
    lines = [', '.join(x for x in parts if x),
             rep.get('landmark') or '',
             f'{rep["village"]} Village Fields' if _has(rep.get('village')) else '',
             lb if _has(lb) and lb.strip() != 'Grama Panchayat' else '',
             f'{rep["mandal"]} Mandal' if _has(rep.get('mandal')) else '']
    addr = rep.get('addressBlock') or (',\n'.join(x for x in lines if x.strip()) + (',\n' if any(x.strip() for x in lines) else '')
                                       + f'{district} Dist.')
    yd = extent_yd
    c = yd / SQYD_PER_CENT
    say = num(f['fmv'])
    f.update({
        'locationLine': loc, 'addressBlock': addr, 'totalSqyd': f'{yd:.2f}',
        'localBodyLine': f'{rep.get("mandal") or "---"} of {dotted(district)} (Dt).',
        'extentDeedLine': f'{cents_txt(c)} Cents (or) {yd:g} Sq. Yds.', 'extentPlanLine': f'{cents_txt(c)} Cents (or) {yd:g} Sq. Yds.',
        'dimHead': 'Dimension of the Property (' + ', '.join(str(d[0]) for d in deeds) + ')',
        'netExtentLine': f'Net Extent = {cents_txt(c)} Cents (or) {yd:g} Sq. Yds.',
        'latitude': f.get('latitude', '---'), 'longitude': f.get('longitude', '---'),
        'bankOfficialBranch': rep.get('bankOfficialBranch') or f'Karnataka Bank, {(case.get("bankBranch") or "---").strip()}.',
        'bankOfficial': rep.get('bankOfficial') or f.get('bankOfficial', '---'),
        'fmvWordsKbl': kbl_words(say), 'sayLine': f'Say Rs {inr(say)}/-', 'forcedLine': f': Rs {f["distress"]}/-',
        'planLine1': (f'Plan Approval {f["planNo"]}, Dt. {f["planDate"]}' if f.get('planNo') not in (None, '', 'NA') else 'Plan Approval : NA'),
        'planLine2': rep.get('planAuthority') or DROP,
        'ownedSince': f'Since {(f.get("deedDate") or "")[-4:] or "---"}',
        'purchaseYearLine': f' Year of Purchase: {f.get("deedDate") or "---"}.',
        'purchasePriceLine': f'Purchase Price: Rs.{inr(num(rep.get("purchasePrice")))}.00' if rep.get('purchasePrice') else 'Purchase Price: ---',
    })
    for side in ('North', 'South', 'East', 'West'):
        f[f'dimDeed{side}'] = rep.get(f'dimDeed{side}') or f['extentDeedLine']
        f[f'dimActual{side}'] = rep.get(f'dimActual{side}') or f[f'dimDeed{side}']


def build_house(case, temps, bank=None):
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    f = apgb.common_fields(case, rep, dict(DEFAULTS))
    bob.owners(f, case, rep)
    owner_fields(f, case, rep)
    f['ownerLine1'] = f['ownerLine1'].strip()
    yd = sum(bob.sqyd_of(x) for x in [rep.get('extentDeedRaw') or pd.get('netExtent'), rep.get('extent2Raw'), rep.get('extent3Raw')] if x)
    rate = num(rep.get('landRatePerSqyd')) or num(pd.get('landRate'))
    guide = num(rep.get('guidelineRatePerSqyd')) or num(pd.get('guidelineRate'))
    land = apgb.money(yd * rate)
    age = int(num(pd.get('buildingAge')))
    life = int(num(rep.get('totalLife'), 60)) or 60
    c_rate = num(rep.get('constructionRate')) or 1800
    floors = [(re.sub(r'\s*\(.*?\)', '', x.get('label') or 'Floor').strip(), num(x.get('value')))
              for x in ((pd.get('siteValue') or {}).get('floors') or []) if num(x.get('value'))]
    codes = [next((v for k, v in bob.FLOOR_CODES.items() if k in lbl.lower()), lbl) for lbl, _ in floors]
    area = sum(a for _, a in floors)
    cost = apgb.money(area * c_rate)
    dep_pct = min(age * num(rep.get('depreciationPerYear'), 1.0), 70.0)
    dep = apgb.money(cost * dep_pct / 100)
    total = land + cost
    fmv, _, _ = bob.final_values(f, case, rep, 'house', total, step=10000, bank=BANK)
    code = '+'.join(codes) or 'GF'
    f.update({
        'reportTitle': f'{rep.get("buildingKindTitle") or "Residential Building"} ({code}) At ' + '{loc}',
        'plinthLines': '\n'.join(f'{cd}={trunc2(a / SQFT_PER_SQM):.2f} Sqm (or) {a:.2f} Sqft' for cd, (_, a) in zip(codes, floors)) or '---',
        'floorsLine': ', '.join(codes) or 'GF', 'floorsWord': rep.get('floorsWord') or ' & '.join(l for l, _ in floors),
        'yearLine': f'{rep.get("yearOfConstruction") or apgb.dt.date.today().year - age}, ',
        'ageLine': f'{age:02d} Years', 'remainingLifeLine': f'{max(life - age, 0)} Years', 'totalLifeLine': f'{life} Years',
        'costLine': f'{code} = {area:.2f} Sqft X Rs {int(c_rate)}/- = Rs {inr(cost)}.00',
        'depLine': f'(-{dep_pct:g}% ) Rs {inr(dep)}/-', 'depNote': f'(1.00 %  @ {age} Years)',
        'depValueLine': f'{code} = Rs {inr(cost - dep)}/-',
        'guidelineRateLine': f': Rs {inr(guide)}/-' if guide else ': ---',
        'guidelineValueLine': f': Rs {inr(apgb.money(guide * yd))}/-' if guide else ': ---',
        'guidelineCalc': f'{yd:.2f}  sqyds X  Rs {int(guide)}/- Sqyd' if guide else '---',
        'rateSqydLine': f'Rs. {inr(rate)}/- Sqyds', 'landCalc': f'{yd:.2f} Sqyds X Rs. {inr(rate)}/- Sqyd =  Rs. {inr(land)}/- ',
        'landValueLine': f'Rs. {inr(land)}/-',
        'totalCalc1': f'Rs {inr(land)}/- + Rs {inr(cost)}/-', 'totalCalc2': f'=Total Rs {inr(total)}/- ',
        'totalCalc3': f'(or) Say Rs {inr(fmv)}/-',
    })
    common(f, case, rep, yd)
    f['reportTitle'] = f['reportTitle'].replace('{loc}', f['locationLine'])
    images = apgb.geo_and_photos(case, rep, f, temps, 7)
    f['latitude'], f['longitude'] = f.get('latitude', '---'), f.get('longitude', '---')
    apply_overrides(f, rep)
    return {'fields': f, 'rows': {}, 'images': images}


# ---------------------------------------------------------------- OPEN SITE
def build_open_site(case, temps, bank=None):
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    f = apgb.common_fields(case, rep, {**DEFAULTS, 'purpose': 'For Bank Purpose', 'briefDesc': 'Residential Vacant Land',
                                       'roadWidth': 'Above 20 Ft Wide Road', 'bankOfficialRole': 'Branch Manager  '})
    bob.owners(f, case, rep)
    owner_fields(f, case, rep)
    f['ownerLine1'] = f['ownerLine1'].strip()
    deed_ac = apgb.acres_of(rep.get('extentDeedRaw') or pd.get('netExtent'))
    net_ac = apgb.acres_of(rep.get('netExtentPlanRaw')) or deed_ac
    yd = trunc2(net_ac * 100 * SQYD_PER_CENT)
    rate = num(rep.get('landRatePerSqyd')) or num(pd.get('landRate'))
    guide = num(rep.get('guidelineRatePerSqyd')) or num(pd.get('guidelineRate'))
    land = apgb.money(yd * rate)
    fmv, _, _ = bob.final_values(f, case, rep, 'openSite', land, step=1000, bank=BANK)
    firm = rep.get('firmName')
    deeds = [pd.get('deedNo')] + [rep[f'deed{k}No'] for k in ('2', '3') if rep.get(f'deed{k}No')]
    survey, door, ward = f['surveyNo'] or '---', f['doorNo'] or '---', rep.get('wardNo') or '---'
    district = f['district']
    lb = rep.get('localBodyName') or 'Kadapa Municipal Corporation'
    loc = (f'Door No : {door}, (Survey No : {survey}), Ward No: {ward}, In {rep.get("landmark") or "---"}, '
           + (f'{rep["nearBy"]}, ' if rep.get('nearBy') else '') + f'{rep.get("village") or "---"} Village, '
           f'{rep.get("town") or "Kadapa Town"} At {lb} of {dotted(district)} Dist.')
    acres = lambda a: f'{a:.3f}'.rstrip('0').rstrip('.') if a % 1 else f'{a:.2f}'
    common(f, case, rep, yd)
    f.update({
        'firmLine': f'“{firm}”' if firm else DROP, 'firmRepLine': 'Represented By Its Owner,' if firm else DROP,
        'deedNo': deeds[0] or '---',
        'deedLine2': f' DEED  NO    :  {deeds[1]}' if len(deeds) > 1 else DROP,
        'deedLine3': f'         \t      DEED NO     :  {deeds[2]}' if len(deeds) > 2 else DROP,
        'netAcres': acres(net_ac), 'reportTitle': f'{rep.get("siteType") or "Residential Vacant Site"}, Near {loc}',
        'localBodyLine': f'{lb}, {dotted(district)} (Dt).', 'districtDotted': dotted(district),
        'landmarkLine': rep.get('landmarkLine') or loc,
        'extentDeedAc': f'Ac {acres(deed_ac)} Cents', 'extentNetAc': f'Ac {acres(net_ac)} Cents',
        'surveyBrackets': f' (Survey No : {survey}),', 'gpsDecimal': '---',
        'noteLine1': rep.get('extentNote1') or f'The total extent of the site as per Doc Nos ({", ".join(str(d) for d in deeds)}) = Ac {acres(deed_ac)} Cents  ',
        'noteLine2': rep.get('extentNote2') or ' ', 'noteLine3': f' = Ac {acres(net_ac)} Cents (or) {yd:.2f} Sqyds for valuation.',
        'purchaseBlock': rep.get('purchaseBlock') or ': Purchase Price: ---',
        'ownedSince': f'Since {(f.get("deedDate") or "")[-4:] or "---"}.' if False else f'Since {(apgb.ddmmyyyy(pd.get("deedDate")) or "---")[-4:]}.',
        'guidelineRateLine': f':  Rs {inr(guide)}/- Sqyd ' if guide else ': ---',
        'guidelineValueLine': f':  Rs {inr(apgb.money(guide * yd))}/-' if guide else ': ---',
        'guidelineCalc': f'{yd:.2f} Sqyds  X  Rs {inr(guide)}/- Sqyd' if guide else '---',
        'rateLine2': f':  Rs {inr(rate)}/- Sqyd', 'rateSqydLine': f'Rs {inr(rate)}/- Sqyd',
        'landCalc': f'Rs {inr(rate)}/- Sqyd X {yd:.2f} Sqyds  ', 'landCalc2': f'=  Rs. {inr(land)}/- ',
        'sayLine': f'Say Rs {inr(fmv)}/-', 'fmvRs': f'Rs {inr(fmv)}/-',
    })
    f['locationLine'] = loc
    f['fmvWordsCoreUpper'] = re.sub(r'^Rupees\s+|\s+Only$', '', words(fmv)).upper().replace('CRORES', 'CRORE')
    f['bankOfficialBranch'] = rep.get('bankOfficialBranch') or f'{(case.get("bankBranch") or "---").strip()} '
    f['dimHead'] = ' Dimension of the Property (' + ', '.join(str(d) for d in deeds) + ')'
    for side in ('North', 'South', 'East', 'West'):
        f[f'dimDeed{side}'] = rep.get(f'dimDeed{side}') or f'                   {f["extentDeedAc"]} '
    f['forcedLine'] = f':  Rs {f["distress"]}/-'
    images = apgb.geo_and_photos(case, rep, f, temps, 4)
    if f.get('latitude') not in (None, '---'):
        f['gpsDecimal'] = f'{f["latitude"]}, {f["longitude"]}'
    apply_overrides(f, rep)
    return {'fields': f, 'rows': {}, 'images': images}


BUILDERS = {'house': build_house, 'open_site': build_open_site}
TEMPLATES = {name: f'karnataka_{name}.docx' for name in BUILDERS}
format_for = apgb.format_for


def build(case, out_path):
    fmt = format_for(case)
    if fmt not in BUILDERS:
        raise NotImplementedError(f'Karnataka Bank {fmt} format not built yet')
    temps = []
    job = BUILDERS[fmt](case, temps)
    job['template'] = os.path.join(HERE, 'templates', TEMPLATES[fmt])
    job['out'] = out_path
    return job, temps

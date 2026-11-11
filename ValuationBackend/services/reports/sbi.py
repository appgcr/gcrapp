"""
State Bank of India report builder (the bank's own formats in sbi_source/).

SBI's rules, read from the bank's sample reports:
  • Flat: land = UDS cents x rate per cent, building = plinth x rate less depreciation
  • "Say" = rounded down to ₹1,000 (52,68,500 → 52,68,000), unless the engineer types it
  • Realizable / forced-sale = % of the Say (Settings → Banks, 95 / 90), rounded to the nearest ₹5,000
    (52,68,000 → 50,05,000 / 47,40,000)
"""
import os
import re

import apgb
import bob
from apgb import inr, num, words, trunc2, SQYD_PER_CENT, SQM_PER_CENT, apply_overrides
from union import dotted, cents_txt
from pnb import owner_fields
from karnataka import kbl_words

HERE = os.path.dirname(os.path.abspath(__file__))
DROP = bob.DROP
BANK = {'label': 'STATE BANK OF INDIA', 'realizable': 0.95, 'distress': 0.90, 'say_step': 1000, 'site_say_step': 1000,
        'value_round': 5000, 'pct_of': 'say', 'defaults': {}}


def build_apartment(case, temps, bank=None):
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    f = apgb.common_fields(case, rep, {'district': 'Y S R', 'place': 'Kadapa', 'structure': 'RCC Framed Structure',
                                       'specFlooring': 'Granite'})
    bob.owners(f, case, rep)
    owner_fields(f, case, rep)
    district = f['district']
    lb = rep.get('localBodyName') or 'Kadapa Municipal Corporation'
    apt = rep.get('aptName') or pd.get('apartmentName') or '---'
    flat = pd.get('flatNo') or rep.get('flatNo') or '---'
    floor = apgb.floor_word(rep.get('floorName') or pd.get('floorNo'))
    survey, door, ward = f['surveyNo'] or '---', f['doorNo'] or '---', rep.get('wardNo') or '---'
    near = rep.get('nearBy')
    firm = rep.get('firmName')
    uds_c = apgb.extent_in_cents(rep.get('udsDeedRaw') or pd.get('netExtent'))
    uds_yd = bob.sqyd_of(rep.get('udsDeedRaw') or pd.get('netExtent'))
    parent_yd = bob.sqyd_of(rep.get('parentExtentDeedRaw'))
    parent_c = parent_yd / SQYD_PER_CENT if parent_yd else 0
    uds_val_c = apgb.extent_in_cents(rep.get('udsPlanRaw')) or uds_c
    rate = num(rep.get('ratePerCent')) or num(rep.get('marketRatePerCent'))
    land = apgb.money(uds_val_c * rate)
    plinth = apgb.sqft_of(rep.get('plinthArea')) or sum(num(x.get('value')) for x in ((pd.get('siteValue') or {}).get('floors') or []))
    carpet = apgb.sqft_of(rep.get('carpetArea')) or plinth * 0.85
    c_rate = num(rep.get('constructionRate')) or 2700
    age = int(num(pd.get('buildingAge')))
    life = int(num(rep.get('totalLife'), 60)) or 60
    dep_pct = min(age * num(rep.get('depreciationPerYear'), 1.0), 70.0)
    bld = apgb.money(plinth * c_rate)
    dep = apgb.money(bld * dep_pct / 100)
    net = bld - dep
    total = land + net
    fmv, _, _ = bob.final_values(f, case, rep, 'apartment', total, step=1000, bank=BANK)
    code = {'Ground': 'GF', 'First': 'FF', 'Second': 'SF', 'Third': 'TF'}.get(floor, floor[:1] + 'F')
    loc = (f'Flat No: {flat} ({floor} Floor), In Survey No: {survey}, Door No :- {door}, Ward No : {ward}, '
           f'in {rep.get("landmark") or "---"},' + (f' Near {near},' if near else '')
           + f' {rep.get("village") or "---"} Village Field  At {lb} of  {dotted(district)} (Dt).')
    partners = [k for k in ('ownerLine1', 'ownerLine2')]
    f.update({
        'aptName': apt, 'aptNameUpper': apt.upper(), 'flatNo': flat, 'floorLine': f'{floor} Floor',
        'floorShortUpper': {'Ground': 'GF', 'First': '1ST', 'Second': '2ND', 'Third': '3RD'}.get(floor, f'{bob.ORDINAL_SHORT.get(floor, floor)}'.upper()),
        'floorsDesc': rep.get('floorsDesc') or '---', 'floorsShort': rep.get('floorsShort') or rep.get('floorsDesc') or '---',
        'firmQuoted': f'“ {firm.upper()} ”' if firm else ' ', 'partnersLabel': 'Managing Partner’s:-' if firm else DROP,
        'ownerLine1': (f'1) {f["ownerLine1"].strip()}' if firm and f['ownerLine2'] != DROP else f['ownerLine1'].strip()),
        'ownerLine2': f'2) {f["ownerLine2"].strip()}' if f['ownerLine2'] != DROP else DROP,
        'owner2Addr': rep.get('owner2Addr') or DROP, 'owner2Addr2': DROP,
        'applicantLabel': 'Applicant :- ' if rep.get('applicantName') else DROP,
        'customerName': f'{rep.get("applicantName") or f["owner1Name"]},  ',
        'customerRel': ((lambda r: (r.rstrip('.') + '.') if r and r != DROP else DROP)
                        (bob.relation(rep.get('applicantRel')) if rep.get('applicantName') else f['owner1RelLine'].strip())),
        'customerAddr': rep.get('applicantAddr') or f['owner1Addr'],
        'udsSqyd': f'{uds_yd:.2f}', 'parentSqyd': f'{parent_yd:g}',
        'aptTitle': f'Residential Flat In “{apt.upper()}” Residential Apartments, {loc}',
        'fmvWordsKbl': re.sub(r'\s+', '  ', kbl_words(fmv)).replace('CRORESS', 'CRORES'),
        'localBodyLine': f'{lb}, {dotted(district)} Dist',
        'bankBranchLine': f'State Bank of India, {(case.get("bankBranch") or "---").strip()}',
        'aptAddress': f'“{apt.upper()}” Residential Apartments {loc}', 'nearLine': f'Near {near},' if near else '---',
        'latLine': f' {f.get("latitude", "---")}" N ', 'lngLine': f' {f.get("longitude", "---")}" E',
        'parentLine': f'{trunc2(parent_c * SQM_PER_CENT):.2f} Sqmts (or) {parent_yd:g} Sqyds (or) {cents_txt(parent_c)} Cents' if parent_yd else '---',
        'udsOutOf': f'{uds_yd:.2f} Sqyds  OUT OF {parent_yd:g} Sqyds', 'udsLine': f'{uds_yd:.2f} Sqyds  (or) {cents_txt(uds_c)} Cents',
        'yearOfConstruction': rep.get('yearOfConstruction') or str(apgb.dt.date.today().year - age),
        'ageLine': f'{age:02d}  Year', 'remainingLifeLine': f'{max(life - age, 0)} Years',
        'rentalLine': f'Future Rental Value : {inr(num(rep.get("monthlyRent")))}/-' if rep.get('monthlyRent') else 'Future Rental Value : --',
        'stageLine': rep.get('flatStatus') or 'Finished',
        'plinthLine': f'Flat no : {flat} = {plinth:.2f} Sqft', 'carpetLine': f'{carpet:.2f} Sqft',
        'guidelineLine': '                   Guideline Value                         Copy Enclosed                                                ',
        'landCalcLine': f'     Land :   {cents_txt(uds_val_c)} Cents X  Rs {inr(rate)}/-Cent                = Rs {inr(land)}/-',
        'buildingCalcLine': f'      Building :  {code} = {plinth:.2f} Sqft X Rs {int(c_rate)}/- Sqft',
        'deprCalcLine': f'            Depreciation at {dep_pct:g} %      (-)    Building',
        'buildingValueLine': f'= Rs {inr(bld)}/-', 'deprValueLine': f'=  Rs {inr(dep) if dep else "0.00"}/-',
        'netBuildingLine': f'= Rs {inr(net)}/-   ', 'siteValueLine': f'=  Rs {inr(land)}/- ', 'netBuildingLine2': f'=   Rs {inr(net)}/- ',
        'totalLine': f'= Rs {inr(total)}/-', 'sayLine': f' Say Rs {inr(fmv)}/-',
        'fmvLine': f'Fair Market value               =  Rs {inr(fmv)}/-',
        'realizableLine': f'Realizable value                  =  Rs {f["realizable"]}/-',
        'distressLine': f'Forced/Distress Sale value =  Rs {f["distress"]}/-',
        'declBackground': f'1) {cents_txt(uds_val_c)} Cents of freehold land belonging to the client. The land bearing At Residential Flat In “{apt.upper()}” Residential  Apartments, {loc}',
        'declBuilding': f'2) Residential Flat on the said land. Built up area : {plinth:.2f} Sqft ',
        'declPurposeLine': f'SBI, {(case.get("bankBranch") or "---").strip()}, {dotted(district)} (Dt)',
        'declDates1': f'Date of appointment : {f["inspectionDate"]} ', 'declDates2': f'Valuation date  : {f["reportDate"]} ',
        'declDates3': f'Date of report   : {f["reportDate"]}',
    })
    for side in ('North', 'South', 'East', 'West'):
        f[f'dimDeed{side}'] = rep.get(f'dimDeed{side}') or '---'
        f[f'dimActual{side}'] = rep.get(f'dimActual{side}') or f[f'dimDeed{side}']
        f[f'fb{side}'] = rep.get(f'fb{side}') or '---'
    images = apgb.geo_and_photos(case, rep, f, temps, 6)
    f['latLine'], f['lngLine'] = f' {f.get("latitude", "---")}" N ', f' {f.get("longitude", "---")}" E'
    apply_overrides(f, rep)
    return {'fields': f, 'rows': {}, 'images': images}


# ---------------------------------------------------------------- HOUSE
HOUSE_EXTRAS = {
    'partC': ['ex_portico', 'ex_frontDoor', 'ex_sitOut', 'ex_ohTank', 'ex_gates'],
    'partD': ['am_wardrobes', 'am_tvUnit', 'am_sinks', 'am_marble', 'am_interior', 'am_elevation',
              'am_paneling', 'am_aluminium', 'am_handRails', 'am_falseCeiling'],
    'partE': ['mi_toilet', 'mi_lumber', 'mi_sump', 'mi_trees'],
    'partF': ['sv_water', 'sv_drainage', 'sv_compoundWall', 'sv_cbDeposits', 'sv_sump'],
}
HOUSE_DEFAULTS = {
    'specGF_foundation': 'PCC & WITH RR STONE MASONARY IN CM OVER SAND CUSHION &SETTELEMENT BED (1:4:8)',
    'specGF_basement': 'RRSTONEMASONARY INCM OF 0.60 HTFROM RL', 'specGF_superstructure': 'BRICK WORK IN CM OF 0.35 M  WIDE 3.0 M HEIGHT',
    'specGF_joinery': 'WOOD DOORS &  WINDOWS', 'specGF_rccWorks': 'RCC FRAMED STRUCTURE',
    'specGF_plastering': 'CEMENT PLASTERING IN CM (1:4) 12 MM THICK', 'specGF_flooring': 'Tiles, Marble & Granite',
    'specGF_specialFinish': '--', 'specGF_roofing': 'RCC', 'specGF_drainage': 'Provided', 'district': 'Y S R', 'place': 'Kadapa',
}


def build_house(case, temps, bank=None):
    bank_h = {**BANK, 'extras': HOUSE_EXTRAS, 'defaults': {'house': HOUSE_DEFAULTS}}
    job = bob.build_house(case, temps, bank=bank_h)
    f = job['fields']
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    owner_fields(f, case, rep)
    survey, door, ward = f['surveyNo'] or '---', f['doorNo'] or '---', f['wardNo']
    lb, district = f['localBodyName'], f['district']
    near = rep.get('nearBy')
    items = [apgb.extent_in_cents(rep.get('extentDeedRaw') or pd.get('netExtent')), apgb.extent_in_cents(rep.get('extent2Raw'))]
    total_c = sum(items)
    plan_c = apgb.extent_in_cents(rep.get('netExtentPlanRaw')) or total_c
    rate = num(rep.get('marketRatePerCent')) or num(pd.get('landRate')) * SQYD_PER_CENT
    guide = num(rep.get('guidelineRatePerSqyd')) or num(pd.get('guidelineRate'))
    land = apgb.money(plan_c * rate)
    age = int(num(pd.get('buildingAge')))
    life = int(num(rep.get('totalLife'), 60)) or 60

    def ydm(c):
        return f'{trunc2(c * SQYD_PER_CENT):.2f} Sqyds (or) {trunc2(c * SQM_PER_CENT):.2f} Sqmts (or) {cents_txt(c)} Cents'
    codes, plinth, carpet = [], [], []
    for i, row in enumerate(job['rows']['fl'], start=1):
        area = num(row['plinth'])
        code = next((v for k, v in bob.FLOOR_CODES.items() if k in row['label'].lower()), row['label'])
        code = 'Stilt' if 'stilt' in row['label'].lower() else code
        codes.append(code)
        plinth.append(f'{code} = {trunc2(area / 10.7639):.2f} Sqmts (or) {area:.2f} Sqfts')
        carpet.append(f'{code} = {trunc2(area * 0.85):.2f} Sqft')
        row.update({'sno': str(i), 'label': row['label'].title(), 'plinthNum': f'{area:.2f}', 'height': rep.get('floorHeight') or ' 10’0”',
                    'age': f'{age} Y', 'depPct': row['depPct'].replace('(-', '(-') + ' ', 'depAmount': row['depAmount'].replace('Rs. 000', 'Rs 0.00').replace('Rs. ', 'Rs ')})
    floors = '+'.join(codes) or 'GF'
    loc = (f'In  Site Survey No’s : {survey}, Door No : {door}, Ward No : {ward}, In {f["landmark"]},'
           + (f' Near {near},' if near else '') + f' {f["village"]} Village Field At {lb} Of  {dotted(district)}. (Dt).')
    i2 = items[1]
    f.update({
        'houseTitle': f'{rep.get("buildingKindTitle") or "Residential Building"} ({floors}), {loc.replace("In  Site", "In Site")}',
        'oldReportNote': rep.get('oldReportNote') or 'Note :-Old Valuation Report Not Submitted By Bank. ',
        'fmvWordsCoreUpper': re.sub(r'^Rupees\s+|\s+Only$', '', words(num(f['fmv']))).upper().replace('CRORES', 'CRORE'),
        'localBodyLine': f'{lb}, {dotted(district)}(Dt).', 'netExtentCents': cents_txt(plan_c),
        'bankBranchLine': f'SBI {(case.get("bankBranch") or "---").upper()}, {dotted(district)}(Dt), ',
        'locationLine': loc, 'nearLine': f'Near {near},' if near else '---',
        'accessLine': rep.get('accessLine') or f'Yes, {rep.get("roadWidth") or "Above 20’0”  Wide CC Road"}',
        'taxName': f['owner1NameLine'], 'taxLine': (f'Assessment No: {f["assessmentNo"]},  Rs {int(num(rep.get("taxAmount")))}/-'
                                                     if rep.get('taxAmount') else f'Assessment No: {f["assessmentNo"]}'),
        'floorsShort': floors, 'yearAgeLine': f' {f["yearOfConstruction"]} ({age} Y)',
        'residualLine': f' {max(life - age, 0)} Years (Total Life OfBuilding : {life} Y)', 'structure': 'RCC Framed Structure',
        'item1Head': 'As Per Deed (Item 1)/Plan' if i2 else 'As Per Deed/Plan', 'item2Head': 'As Per Deed (Item 2)/Plan' if i2 else 'As Per Actual',
        'item1Extent': f'{trunc2(items[0] * SQYD_PER_CENT):.2f} Sqyds (or) {cents_txt(items[0])} Cents',
        'item2Extent': (f'{trunc2(i2 * SQYD_PER_CENT):.2f} Sqyds (or) {cents_txt(i2)} Cents' if i2 else
                        f'{trunc2(items[0] * SQYD_PER_CENT):.2f} Sqyds (or) {cents_txt(items[0])} Cents'),
        'totalItemsLine': ('Item 1 + Item 2 = ' if i2 else '') + ydm(total_c), 'extentTotalLine': ydm(total_c),
        'roadAffected': rep.get('roadAffected') or 'NA',
        'netLineA': f'{trunc2(plan_c * SQYD_PER_CENT):.2f} Sqyds (or) {trunc2(plan_c * SQM_PER_CENT):.2f} Sqmts (or) ',
        'netLineB': f'{cents_txt(plan_c)} Cents',
        'plinthLines': '\n'.join(plinth) or '---', 'carpetLines': '\n'.join(carpet) or '---',
        'marketRateLine': f'Rs {inr(rate)}/- Cent', 'landCalc': f' {cents_txt(plan_c)} Cents X  Rs {inr(rate)}/- Cent ',
        'landValueLine': f'Rs {inr(land)}/-',
        'guidelineRateLine': f'Rs {inr(guide)}/- Sqyds' if guide else '---',
        'guidelineValueLine': f'Rs {inr(apgb.money(guide * trunc2(total_c * SQYD_PER_CENT)))}/-' if guide else '---',
        'fee': inr(num(rep.get('fee')) or 4000), 'feeWords': f'Rupees  {re.sub(r"^Rupees ", "", words(num(rep.get("fee")) or 4000))}',
    })
    for side in ('North', 'South', 'East', 'West'):
        f[f'dim2{side}'] = rep.get(f'dim2{side}') or f[f'dimActual{side}']
    parts = {}
    for part, keys in HOUSE_EXTRAS.items():
        tot = 0
        for k in keys:
            v = num(rep.get(k))
            tot += v
            f[k] = f'Rs {inr(v)}/-' if v else 'Rs ---'
        parts[part] = tot
        f[part] = f'Rs {inr(tot) if tot else "0.00"}/-'
    building = num(re.sub(r'[^\d.]', '', f['buildingTotalLine']))
    total = land + building + sum(parts.values())
    say = num(f['fmv'])
    f.update({
        'absA': f'Rs    {inr(land)}/-', 'absB': f'Rs {inr(building)}/-',
        **{k: f'Rs {inr(parts[p]) if parts[p] else "0.00"}/-'
           for k, p in (('absC', 'partC'), ('absD', 'partD'), ('absE', 'partE'), ('absF', 'partF'))},
        'absTotalSay': f'Rs {inr(total)}/- Say As Rs {inr(say)}/-', 'fmvLine': f'Rs {inr(say)}/-',
        'realizableLine': f'Rs {f["realizable"]}/-', 'distressLine': f'Rs {f["distress"]}/-',
        'declBackground': f'Net Extent  {cents_txt(plan_c)} Cents  {loc[4:]}',
        'declBranchLine': f'SBI – {(case.get("bankBranch") or "---").strip()},', 'districtDottedDt': f'{dotted(district)}. (Dt).',
        'declDates1': f'Date of appointment :{f["inspectionDate"]}, ', 'declDates2': f'Valuation date:{f["reportDate"]}, ',
        'declDates3': f'Date of Report:{f["reportDate"]}',
    })
    apply_overrides(f, rep)
    return job


BUILDERS = {'apartment': build_apartment, 'house': build_house}
TEMPLATES = {name: f'sbi_{name}.docx' for name in BUILDERS}
format_for = apgb.format_for


def build(case, out_path):
    fmt = format_for(case)
    if fmt not in BUILDERS:
        raise NotImplementedError(f'State Bank of India {fmt} format not built yet')
    temps = []
    job = BUILDERS[fmt](case, temps)
    job['template'] = os.path.join(HERE, 'templates', TEMPLATES[fmt])
    job['out'] = out_path
    return job, temps
